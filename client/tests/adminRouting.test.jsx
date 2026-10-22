import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import App from '../src/App';
import { api, getToken, setToken } from '../src/lib/api';

// A fake API server. A request is "authorised" only if it carries the one valid token and it has not been revoked.
let revoked;
let calls;
function installServer() {
  revoked = false;
  calls = [];
  api.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const reply = (status, data) => {
      const res = { data, status, statusText: '', headers: {}, config };
      if (status >= 400) throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, res);
      return res;
    };
    const auth = config.headers.get ? config.headers.get('Authorization') : config.headers.Authorization;
    if (config.url === '/admin/login') {
      return String(config.data).includes('correct-password')
        ? reply(200, { success: true, data: { token: 'good-token', email: 'admin@x.com' } })
        : reply(401, { success: false, message: 'Incorrect email or password.' });
    }
    if (config.url.startsWith('/admin')) {
      if (auth !== 'Bearer good-token' || revoked) return reply(401, { success: false, message: 'Authentication required.' });
      if (config.url === '/admin/logout') { revoked = true; return reply(200, { success: true }); }
      if (config.url === '/admin/me') return reply(200, { success: true, data: { email: 'admin@x.com', role: 'admin', permissions: ['services:read', 'appointments:read', 'appointments:manage', 'messages:read', 'messages:manage'] } });
      return reply(200, { success: true, data: [] });
    }
    if (config.url === '/business') return reply(200, { success: true, data: { timezone: 'Asia/Manila', maxAdvanceDays: 90, technicians: [], hours: {}, categories: [] } });
    return reply(200, { success: true, data: [] });
  };
}

const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
const publicNav = () => screen.queryByRole('navigation', { name: 'Main' });
const loginHeading = () => screen.findByRole('heading', { name: 'Admin sign in' });
const dashboardTabs = () => screen.findByRole('tablist', { name: 'Admin sections' });

beforeEach(() => {
  window.scrollTo = () => {};
  sessionStorage.clear();
  installServer();
});
afterEach(cleanup);

describe('public website stays separate from the admin area', () => {
  for (const path of ['/', '/services', '/gallery', '/booking', '/about', '/contact', '/no-such-page']) {
    it(`${path} shows the customer navbar and has no admin links`, async () => {
      const { container } = renderAt(path);
      await waitFor(() => expect(publicNav()).not.toBeNull());
      expect(container.querySelectorAll('a[href*="admin" i]').length).toBe(0);
      expect(container.textContent.toLowerCase()).not.toContain('admin');
      // The footer is part of the public layout too
      expect(container.querySelector('footer')).not.toBeNull();
    });
  }

  it('the public navbar lists exactly the customer links', () => {
    renderAt('/');
    const links = [...publicNav().querySelectorAll('a')].map((a) => a.textContent);
    expect(links).toEqual(['Home', 'Services', 'Gallery', 'Booking', 'About Us', 'Contact']);
  });
});

describe('unauthenticated visitors', () => {
  it('/admin redirects to /admin/login', async () => {
    renderAt('/admin');
    await loginHeading();
    expect(calls.some((c) => c.includes('/admin/appointments'))).toBe(false); // no dashboard data was requested
  });

  it('/admin/login shows the login page without customer navigation', async () => {
    const { container } = renderAt('/admin/login');
    await loginHeading();
    expect(publicNav()).toBeNull();
    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelectorAll('a').length).toBe(0); // no links out of the login page
  });

  it.each(['/admin/foo', '/admin/settings/deep', '/admin/'])('unknown admin route %s ends at the login page, not the public 404', async (path) => {
    renderAt(path);
    await loginHeading();
    expect(publicNav()).toBeNull();
    expect(screen.queryByText(/couldn't find that page/i)).toBeNull();
  });

  it('a wrong password shows an error and stays on the login page', async () => {
    renderAt('/admin/login');
    await loginHeading();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect email or password.')).toBeTruthy();
    expect(getToken()).toBeNull();
  });
});

describe('signing in, refreshing and signing out', () => {
  it('successful login lands on the dashboard (no public navbar), and a refresh keeps the session', async () => {
    const first = renderAt('/admin/login');
    await loginHeading();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@x.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await dashboardTabs();
    expect(publicNav()).toBeNull();
    expect(getToken()).toBe('good-token');
    first.unmount();

    // "Refresh": a brand-new app instance at /admin with the same sessionStorage
    renderAt('/admin');
    await dashboardTabs();
  });

  it('an authenticated admin visiting /admin/login is redirected to /admin (after the server verifies the token)', async () => {
    setToken('good-token');
    renderAt('/admin/login');
    await dashboardTabs();
    expect(calls).toContain('GET /admin/me');
  });

  it('unknown admin routes send an authenticated admin to the dashboard', async () => {
    setToken('good-token');
    renderAt('/admin/whatever');
    await dashboardTabs();
  });

  it('sign out revokes the token on the server, clears it, and returns to the login page', async () => {
    setToken('good-token');
    renderAt('/admin');
    await dashboardTabs();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await loginHeading();
    expect(calls).toContain('POST /admin/logout');
    expect(getToken()).toBeNull();
    expect(revoked).toBe(true);
  });

  it('after sign out, the old token no longer opens the dashboard', async () => {
    setToken('good-token');
    const first = renderAt('/admin');
    await dashboardTabs();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await loginHeading();
    first.unmount();
    setToken('good-token'); // someone replays the copied token
    renderAt('/admin');
    await loginHeading();
    expect(getToken()).toBeNull();
  });
});

describe('invalid sessions', () => {
  it('a stored but invalid token is not trusted: /admin goes to login and the token is cleared', async () => {
    setToken('forged-or-expired');
    renderAt('/admin');
    await loginHeading();
    expect(getToken()).toBeNull();
  });

  it('a stored but invalid token does not skip the login page', async () => {
    setToken('forged-or-expired');
    renderAt('/admin/login');
    await loginHeading();
    expect(getToken()).toBeNull();
  });

  it('a role value planted in browser storage grants nothing', async () => {
    sessionStorage.setItem('role', 'admin');
    localStorage.setItem('role', 'admin');
    localStorage.setItem('isAdmin', 'true');
    renderAt('/admin');
    await loginHeading();
    localStorage.clear();
  });

  it('if the server cannot be reached the dashboard is not shown and a retry is offered', async () => {
    setToken('good-token');
    api.defaults.adapter = async (config) => { throw new AxiosError('Network Error', 'ERR_NETWORK', config); };
    renderAt('/admin');
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('a session that expires while using the dashboard clears the token and redirects to the login page', async () => {
    const original = window.location;
    const replace = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, pathname: '/admin', replace } });
    setToken('good-token');
    renderAt('/admin');
    await dashboardTabs();
    revoked = true; // session ends server-side
    fireEvent.click(screen.getByRole('tab', { name: 'Services' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/admin/login?reason=expired'));
    expect(getToken()).toBeNull();
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('the login page explains an ended session', async () => {
    renderAt('/admin/login?reason=expired');
    expect(await screen.findByText('Your session has ended. Please sign in again.')).toBeTruthy();
  });
});
