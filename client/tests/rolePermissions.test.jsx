import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import App from '../src/App';
import { api, getToken, setToken } from '../src/lib/api';

const ADMIN_ME = { email: 'owner@luxenails.test', role: 'admin', permissions: ['services:read', 'appointments:read', 'appointments:manage', 'messages:read', 'messages:manage'] };
const DEV_ME = { email: 'dev@maintainer.test', role: 'developer', permissions: ['services:read', 'services:write'] };
const SERVICES = [
  { _id: 's1', name: 'Gel Manicure', category: 'nail-services', description: 'Long-lasting gel polish with a glossy finish.', price: 450, durationMinutes: 60, isStartingPrice: false, active: true, sortOrder: 0, image: `/uploads/services/${'a'.repeat(32)}.png` },
  { _id: 's2', name: 'Hot Stone Massage', category: 'massage', description: 'Warm stones to relax tired muscles.', price: 900, durationMinutes: 90, isStartingPrice: true, active: false, sortOrder: 1, image: '/images/cat-massage-1.svg' },
];
const APPT = { _id: 'a1', reference: 'LN-ROLE0001', date: '2099-01-05', timeLabel: '10:00 AM', customerName: 'Jane Customer', email: 'jane@example.com', phone: '0917 111 2222', serviceName: 'Gel Manicure', categoryLabel: 'Nail Services', treatmentType: 'nail', durationMinutes: 60, technicianName: 'Ana', status: 'pending', emailVerified: true, bookingEmail: { status: 'sent' }, confirmedEmail: { status: 'not_sent' } };
const MSG = { _id: 'm1', subject: 'Opening hours?', name: 'Sam', email: 'sam@example.com', message: 'Are you open on Sunday?', read: false, createdAt: '2099-01-01T10:00:00Z' };

let me; // what /admin/me reports
let calls; // every admin request made by the page
let override; // (config) => response | undefined

beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
  setToken('good-token');
  window.scrollTo = () => {};
  window.confirm = () => true;
  me = ADMIN_ME; calls = []; override = null;
  api.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const ok = (data, status = 200) => ({ data, status, statusText: '', headers: {}, config });
    const fail = (status, data) => { throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, { data, status, statusText: '', headers: {}, config }); };
    const custom = override?.(config);
    if (custom) { if (custom.status >= 400) fail(custom.status, custom.data); return ok(custom.data, custom.status); }
    if (config.url === '/admin/me') return ok({ success: true, data: me });
    if (config.url === '/admin/services' && config.method === 'get') return ok({ success: true, data: SERVICES });
    if (config.url === '/admin/appointments' && config.method === 'get') return ok({ success: true, data: [APPT] });
    if (config.url === '/admin/messages') return ok({ success: true, data: [MSG] });
    return ok({ success: true, data: {} });
  };
});
afterEach(cleanup);

const open = () => render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent);

describe('business admin', () => {
  it('sees Appointments, Services and Messages, labelled as the business admin', async () => {
    open();
    await screen.findByRole('tablist');
    expect(tabNames()).toEqual(['Appointments', 'Services', 'Messages']);
    expect(screen.getByTestId('role-badge').textContent).toBe('Business admin');
  });

  it('can view every service with its details and image, but has no way to change them', async () => {
    open();
    fireEvent.click(await screen.findByRole('tab', { name: 'Services' }));
    await screen.findByText('Gel Manicure');
    // details
    expect(screen.getByText('Hot Stone Massage')).toBeTruthy();
    expect(screen.getByText(/Long-lasting gel polish/)).toBeTruthy();
    expect(screen.getByText(/Warm stones to relax/)).toBeTruthy();
    expect(screen.getByText(/₱450/)).toBeTruthy();
    expect(screen.getByText(/From ₱900/)).toBeTruthy();
    expect(screen.getByText('inactive')).toBeTruthy();
    const imgs = [...document.querySelectorAll('li img')].map((i) => i.getAttribute('src'));
    expect(imgs).toEqual([`/uploads/services/${'a'.repeat(32)}.png`, '/images/cat-massage-1.svg']);
    // no write controls anywhere
    expect(screen.queryByRole('button', { name: 'Add service' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByLabelText('Upload from this device')).toBeNull();
    expect(screen.getByTestId('services-readonly-note').textContent).toMatch(/website maintainer/);
    // the category filter (read-only convenience) still works
    fireEvent.change(screen.getByLabelText('Show category'), { target: { value: 'massage' } });
    expect(screen.queryByText('Gel Manicure')).toBeNull();
    expect(screen.getByText('Hot Stone Massage')).toBeTruthy();
    expect(calls.filter((c) => /^(POST|PUT|DELETE) \/admin\/services/.test(c))).toEqual([]);
  });

  it('keeps using appointments and messages', async () => {
    open();
    expect(await screen.findByText('LN-ROLE0001')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Messages' }));
    expect(await screen.findByText('Opening hours?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeTruthy();
  });

  it('tampering with browser storage or globals does not unlock service management', async () => {
    sessionStorage.setItem('role', 'developer'); localStorage.setItem('role', 'developer');
    localStorage.setItem('permissions', JSON.stringify(['services:write'])); localStorage.setItem('isDeveloper', 'true');
    window.__ROLE__ = 'developer'; window.__PERMISSIONS__ = ['services:write'];
    open();
    fireEvent.click(await screen.findByRole('tab', { name: 'Services' }));
    await screen.findByText('Gel Manicure');
    expect(screen.getByTestId('role-badge').textContent).toBe('Business admin');
    expect(screen.queryByRole('button', { name: 'Add service' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('the role comes only from the server: the same page shows management controls if the server says developer', async () => {
    me = DEV_ME;
    open();
    await screen.findByText('Gel Manicure');
    expect(screen.getByRole('button', { name: 'Add service' })).toBeTruthy();
  });
});

describe('developer', () => {
  beforeEach(() => { me = DEV_ME; });

  it('sees only the Services tab, labelled as developer, and never requests customer data', async () => {
    open();
    await screen.findByText('Gel Manicure');
    expect(tabNames()).toEqual(['Services']);
    expect(screen.getByTestId('role-badge').textContent).toBe('Developer');
    expect(calls.some((c) => c.includes('/admin/appointments') || c.includes('/admin/messages'))).toBe(false);
    expect(screen.queryByText('LN-ROLE0001')).toBeNull();
  });

  it('has Add, Edit and Delete, and the existing upload form', async () => {
    open();
    await screen.findByText('Gel Manicure');
    expect(screen.getByRole('button', { name: 'Add service' })).toBeTruthy();
    const row = screen.getByText('Gel Manicure').closest('li');
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Delete' })).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    expect(await screen.findByLabelText('Upload from this device')).toBeTruthy();
  });

  it('delete is sent to the real endpoint', async () => {
    open();
    await screen.findByText('Gel Manicure');
    fireEvent.click(within(screen.getByText('Gel Manicure').closest('li')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls).toContain('DELETE /admin/services/s1'));
  });
});

describe('what happens when the server refuses', () => {
  it('a permission refusal (403 FORBIDDEN) keeps the person signed in and shows the reason', async () => {
    me = DEV_ME;
    override = (c) => (c.method === 'delete' ? { status: 403, data: { success: false, code: 'FORBIDDEN', message: 'Your account does not have permission to do this.' } } : undefined);
    const original = window.location;
    const replace = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, pathname: '/admin', replace } });
    open();
    await screen.findByText('Gel Manicure');
    fireEvent.click(within(screen.getByText('Gel Manicure').closest('li')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Your account does not have permission to do this.')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(getToken()).toBe('good-token');
    expect(screen.getByRole('tablist')).toBeTruthy();
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('a refusal while loading a list shows an error message instead of an endless spinner', async () => {
    override = (c) => (c.url === '/admin/appointments' ? { status: 403, data: { success: false, code: 'FORBIDDEN', message: 'Your account does not have permission to do this.' } } : undefined);
    open();
    expect(await screen.findByText('Your account does not have permission to do this.')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a 403 saying the account is not an admin at all ends the session and goes to login', async () => {
    const original = window.location;
    const replace = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, pathname: '/admin', replace } });
    override = (c) => (c.url === '/admin/appointments' ? { status: 403, data: { success: false, code: 'NOT_ADMIN', message: 'Not authorized.' } } : undefined);
    open();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/login?reason=expired'));
    expect(getToken()).toBeNull();
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('an account with no permissions sees a clear message and no sections', async () => {
    me = { email: 'x@y.z', role: 'admin', permissions: [] };
    open();
    expect(await screen.findByText('This account has no dashboard sections assigned.')).toBeTruthy();
    expect(screen.queryAllByRole('tab')).toEqual([]);
  });
});
