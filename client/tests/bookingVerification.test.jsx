import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import Booking from '../src/pages/Booking';
import { api } from '../src/lib/api';

const SERVICE = { _id: 's1', name: 'Classic Manicure', category: 'nail-services', price: 350, durationMinutes: 45, description: 'x' };

// Fake API. Each behaviour can be overridden per test.
let calls;
let behave;
function install() {
  calls = [];
  behave = {
    request: () => ({ status: 202, data: { success: true, data: { expiresInSeconds: 600, cooldownSeconds: 60 } } }),
    verify: () => ({ status: 200, data: { success: true, data: { verified: true, verificationToken: 'tok-123' } } }),
    book: () => ({ status: 201, data: { success: true, data: { reference: 'LN-ABCD1234', status: 'pending', serviceName: 'Classic Manicure', categoryLabel: 'Nail Services', servicePrice: 350, durationMinutes: 45, date: '2099-01-05', timeLabel: '10:00 AM', technicianName: 'Ana', emailStatus: 'sent' } } }),
  };
  api.defaults.adapter = async (config) => {
    const body = config.data ? JSON.parse(config.data) : undefined;
    calls.push({ method: config.method, url: config.url, body });
    const respond = ({ status, data }) => {
      const res = { data, status, statusText: '', headers: {}, config };
      if (status >= 400) throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, res);
      return res;
    };
    if (config.url === '/services') return respond({ status: 200, data: { success: true, data: [SERVICE] } });
    if (config.url === '/business') return respond({ status: 200, data: { success: true, data: { timezone: 'Asia/Manila', maxAdvanceDays: 90, technicians: [{ id: 'ana', name: 'Ana' }] } } });
    if (config.url === '/appointments/availability') return respond({ status: 200, data: { success: true, data: { closed: false, slots: [{ time: '10:00', label: '10:00 AM', available: true }] } } });
    if (config.url === '/verification/email/request') return respond(behave.request(body));
    if (config.url === '/verification/email/verify') return respond(behave.verify(body));
    if (config.url === '/appointments' && config.method === 'post') return respond(behave.book(body));
    return respond({ status: 200, data: { success: true, data: [] } });
  };
}
const callsTo = (url) => calls.filter((c) => c.url === url);

const status = () => screen.getByTestId('email-status').textContent;
const confirmBtn = () => screen.getByRole('button', { name: /Confirm Booking/i });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function renderPage() {
  render(<MemoryRouter initialEntries={['/booking']}><Booking /></MemoryRouter>);
  await screen.findByLabelText(/Service Category/);
}
async function fillRest() {
  type(/Full Name/, 'Jane Doe');
  type(/Phone Number/, '0917 123 4567');
  type(/Service Category/, 'nail-services');
  await waitFor(() => expect(screen.getByLabelText(/Select Service/).disabled).toBe(false));
  type(/Select Service/, 's1');
  type(/Preferred Date/, '2099-01-05');
  fireEvent.click(await screen.findByRole('radio', { name: '10:00 AM' }));
}
async function verifyEmail(email = 'jane@example.com', code = '123456') {
  type(/Email Address/, email);
  fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
  await screen.findByLabelText('6-digit verification code');
  fireEvent.change(screen.getByLabelText('6-digit verification code'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  await waitFor(() => expect(status()).toBe('Verification successful'));
}

beforeEach(() => { sessionStorage.clear(); window.scrollTo = () => {}; install(); });
afterEach(cleanup);

describe('before verification', () => {
  it('starts as "Email not verified" with booking disabled and a hint', async () => {
    await renderPage();
    expect(status()).toBe('Email not verified');
    expect(screen.getByRole('button', { name: 'Verify Email' })).toBeTruthy();
    expect(confirmBtn().disabled).toBe(true);
    expect(screen.getByText(/Verify your email address above to enable booking/i)).toBeTruthy();
    expect(screen.queryByLabelText('6-digit verification code')).toBeNull();
  });

  it('even with every other field filled, booking stays disabled until the email is verified', async () => {
    await renderPage();
    await fillRest();
    type(/Email Address/, 'jane@example.com');
    expect(confirmBtn().disabled).toBe(true);
  });

  it('rejects an invalid email locally without calling the server', async () => {
    await renderPage();
    type(/Email Address/, 'not-an-email');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    expect(await screen.findByText('Enter a valid email address first.')).toBeTruthy();
    expect(status()).toBe('Verification failed');
    expect(callsTo('/verification/email/request').length).toBe(0);
  });
});

describe('requesting and entering the code', () => {
  it('sends the code request, shows "Verification email sent", the code box and a resend countdown', async () => {
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    await screen.findByLabelText('6-digit verification code');
    expect(status()).toBe('Verification email sent');
    expect(callsTo('/verification/email/request')[0].body).toEqual({ email: 'jane@example.com' });
    const resend = screen.getByRole('button', { name: /Resend in 60s/ });
    expect(resend.disabled).toBe(true);
    expect(confirmBtn().disabled).toBe(true);
  });

  it('the resend countdown ticks down and then offers "Resend code"', async () => {
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    await screen.findByRole('button', { name: /Resend in 60s/ });
    behave.request = () => ({ status: 202, data: { success: true, data: { expiresInSeconds: 600, cooldownSeconds: 2 } } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Resend in 5\ds/ })).toBeTruthy(), { timeout: 3500 });
  });

  it('the code box only accepts digits and at most six of them', async () => {
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    const box = await screen.findByLabelText('6-digit verification code');
    fireEvent.change(box, { target: { value: '12ab34567890' } });
    expect(box.value).toBe('123456');
    fireEvent.change(box, { target: { value: '12' } });
    expect(screen.getByRole('button', { name: 'Verify code' }).disabled).toBe(true);
  });

  it('a wrong code shows the server message and stays unverified', async () => {
    behave.verify = () => ({ status: 400, data: { success: false, code: 'INVALID_CODE', message: 'Incorrect code. 4 attempts left.' } });
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    fireEvent.change(await screen.findByLabelText('6-digit verification code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    expect(await screen.findByText('Incorrect code. 4 attempts left.')).toBeTruthy();
    expect(confirmBtn().disabled).toBe(true);
    expect(screen.getByLabelText('6-digit verification code')).toBeTruthy(); // can try again
  });

  it('an expired code shows "Verification code expired" and offers a new code', async () => {
    behave.verify = () => ({ status: 410, data: { success: false, code: 'CODE_EXPIRED', message: 'Verification code expired. Please request a new code.' } });
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    fireEvent.change(await screen.findByLabelText('6-digit verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await waitFor(() => expect(status()).toBe('Verification code expired'));
    expect(confirmBtn().disabled).toBe(true);
  });

  it('too many attempts shows "Verification failed"', async () => {
    behave.verify = () => ({ status: 429, data: { success: false, code: 'TOO_MANY_ATTEMPTS', message: 'Too many incorrect attempts. Please request a new code.' } });
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    fireEvent.change(await screen.findByLabelText('6-digit verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await waitFor(() => expect(status()).toBe('Verification failed'));
    expect(screen.getByText(/Too many incorrect attempts/)).toBeTruthy();
  });

  it('if the email cannot be sent, the customer sees why and nothing is verified', async () => {
    behave.request = () => ({ status: 502, data: { success: false, code: 'EMAIL_SEND_FAILED', message: 'We could not send the verification email. Please check the address and try again.' } });
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    expect(await screen.findByText(/could not send the verification email/)).toBeTruthy();
    expect(status()).toBe('Verification failed');
    expect(screen.queryByLabelText('6-digit verification code')).toBeNull();
    expect(confirmBtn().disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Verify Email' }).disabled).toBe(false); // can retry at once
  });

  it('a cooldown response keeps the code box and shows the wait', async () => {
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Verify Email/ }));
    await screen.findByLabelText('6-digit verification code');
    expect(screen.getByRole('button', { name: /Resend in/ }).disabled).toBe(true);
  });
});

describe('after a correct code', () => {
  it('shows "Verification successful" and enables booking', async () => {
    await renderPage();
    await fillRest();
    await verifyEmail();
    expect(confirmBtn().disabled).toBe(false);
    expect(screen.getByRole('button', { name: /Verified/ }).disabled).toBe(true);
    expect(screen.queryByLabelText('6-digit verification code')).toBeNull();
    expect(callsTo('/verification/email/verify')[0].body).toEqual({ email: 'jane@example.com', code: '123456' });
  });

  it('changing the email afterwards cancels the verification and disables booking again', async () => {
    await renderPage();
    await fillRest();
    await verifyEmail();
    type(/Email Address/, 'someone-else@example.com');
    expect(status()).toBe('Email not verified');
    expect(confirmBtn().disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Verify Email' })).toBeTruthy();
  });

  it('changing the email while a code is pending discards the code box', async () => {
    await renderPage();
    type(/Email Address/, 'jane@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Email' }));
    await screen.findByLabelText('6-digit verification code');
    type(/Email Address/, 'jane2@example.com');
    expect(screen.queryByLabelText('6-digit verification code')).toBeNull();
    expect(status()).toBe('Email not verified');
  });

  it('normalises only in comparison: re-typing the same address in other case keeps the verification', async () => {
    await renderPage();
    await fillRest();
    await verifyEmail('jane@example.com');
    type(/Email Address/, 'JANE@example.com');
    expect(status()).toBe('Verification successful');
    expect(confirmBtn().disabled).toBe(false);
  });
});

describe('submitting the booking', () => {
  it('sends the server-issued token with the email (and never an "emailVerified" flag), then shows the reference', async () => {
    await renderPage();
    await fillRest();
    await verifyEmail();
    fireEvent.click(confirmBtn());
    expect(await screen.findByText('LN-ABCD1234')).toBeTruthy();
    const body = callsTo('/appointments').find((c) => c.method === 'post').body;
    expect(body.verificationToken).toBe('tok-123');
    expect(body.email).toBe('jane@example.com');
    expect(body).not.toHaveProperty('emailVerified');
    expect(screen.getByText(/awaiting salon confirmation/)).toBeTruthy();
    expect(screen.getByText(/Your email address is verified/)).toBeTruthy();
  });

  it('double clicking submits only once', async () => {
    let release;
    behave.book = () => ({ status: 201, data: { success: true, data: { reference: 'LN-ABCD1234', status: 'pending', serviceName: 'x', categoryLabel: 'x', servicePrice: 1, durationMinutes: 45, date: '2099-01-05', timeLabel: '10:00 AM', technicianName: 'Ana', emailStatus: 'sent' } } });
    await renderPage();
    await fillRest();
    await verifyEmail();
    const orig = api.defaults.adapter;
    const gate = new Promise((r) => { release = r; });
    api.defaults.adapter = async (config) => { if (config.url === '/appointments' && config.method === 'post') await gate; return orig(config); };
    const btn = confirmBtn(); // its label changes while submitting, so grab the element once
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await act(async () => { release(); });
    await screen.findByText('LN-ABCD1234');
    expect(callsTo('/appointments').filter((c) => c.method === 'post').length).toBe(1);
  });

  it('if the server says the email is not verified, the page returns to "not verified"', async () => {
    behave.book = () => ({ status: 403, data: { success: false, code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email address before booking.' } });
    await renderPage();
    await fillRest();
    await verifyEmail();
    fireEvent.click(confirmBtn());
    expect(await screen.findByText('Please verify your email address before booking.')).toBeTruthy();
    await waitFor(() => expect(status()).toBe('Email not verified'));
    expect(confirmBtn().disabled).toBe(true);
  });

  it('an expired authorization sends the customer back to verify again', async () => {
    behave.book = () => ({ status: 403, data: { success: false, code: 'VERIFICATION_EXPIRED', message: 'Your email verification has expired. Please verify your email again.' } });
    await renderPage();
    await fillRest();
    await verifyEmail();
    fireEvent.click(confirmBtn());
    await screen.findByText(/verification has expired/);
    await waitFor(() => expect(status()).toBe('Email not verified'));
  });

  it('a slot conflict keeps the email verified so the customer can pick another time', async () => {
    behave.book = () => ({ status: 409, data: { success: false, code: 'SLOT_TAKEN', message: 'Sorry, that time was just taken. Please pick another slot.' } });
    await renderPage();
    await fillRest();
    await verifyEmail();
    fireEvent.click(confirmBtn());
    expect(await screen.findByText(/that time was just taken/)).toBeTruthy();
    expect(status()).toBe('Verification successful');
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm Booking/ })).toBeTruthy());
  });

  it('a network failure shows an error and allows retrying with the same verification', async () => {
    await renderPage();
    await fillRest();
    await verifyEmail();
    const orig = api.defaults.adapter;
    api.defaults.adapter = async (config) => {
      if (config.url === '/appointments' && config.method === 'post') throw new AxiosError('Network Error', 'ERR_NETWORK', config);
      return orig(config);
    };
    fireEvent.click(confirmBtn());
    expect(await screen.findByText(/Cannot reach the server/)).toBeTruthy();
    expect(status()).toBe('Verification successful');
    api.defaults.adapter = orig;
    fireEvent.click(confirmBtn());
    expect(await screen.findByText('LN-ABCD1234')).toBeTruthy();
  });

  it('shows an honest message when the booking was saved but the email failed', async () => {
    behave.book = () => ({ status: 201, data: { success: true, data: { reference: 'LN-ABCD1234', status: 'pending', serviceName: 'x', categoryLabel: 'x', servicePrice: 1, durationMinutes: 45, date: '2099-01-05', timeLabel: '10:00 AM', technicianName: 'Ana', emailStatus: 'failed' } } });
    await renderPage();
    await fillRest();
    await verifyEmail();
    fireEvent.click(confirmBtn());
    await screen.findByText('LN-ABCD1234');
    expect(screen.getByText(/booking is saved, but we could not send the email/i)).toBeTruthy();
  });
});
