import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import App from '../src/App';
import { api, setToken } from '../src/lib/api';

const UPLOADED = { _id: 'svc1', name: 'Gel Manicure', category: 'nail-services', description: 'Gel polish', price: 450, durationMinutes: 60, isStartingPrice: false, active: true, sortOrder: 0, image: `/uploads/services/${'a'.repeat(32)}.png` };
const MANUAL = { _id: 'svc2', name: 'Classic Manicure', category: 'nail-services', description: 'Classic', price: 350, durationMinutes: 45, isStartingPrice: true, active: false, sortOrder: 1, image: '/images/service-manicure.svg' };

let requests; // captured service writes
let respond; // override per test
let gate; // optional promise that holds a write open (to test the "in progress" state)

const entries = (fd) => Object.fromEntries([...fd.entries()].map(([k, v]) => [k, v instanceof File ? v : String(v)]));

beforeEach(() => {
  sessionStorage.clear();
  setToken('good-token');
  window.scrollTo = () => {};
  URL.createObjectURL = vi.fn(() => 'blob:preview-1');
  URL.revokeObjectURL = vi.fn();
  window.confirm = () => true;
  requests = []; respond = null; gate = null;
  api.defaults.adapter = async (config) => {
    const ok = (data, status = 200) => ({ data, status, statusText: '', headers: {}, config });
    const fail = (status, data) => { throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, { data, status, statusText: '', headers: {}, config }); };
    if (config.url === '/admin/me') return ok({ success: true, data: { email: 'dev@b.c', role: 'developer', permissions: ['services:read', 'services:write'] } });
    if (config.url === '/admin/services' && config.method === 'get') return ok({ success: true, data: [UPLOADED, MANUAL] });
    if (config.url.startsWith('/admin/services') && ['post', 'put'].includes(config.method)) {
      const isForm = config.data instanceof FormData;
      requests.push({ method: config.method, url: config.url, isForm, fields: isForm ? entries(config.data) : config.data, headers: { ...config.headers } });
      config.onUploadProgress?.({ loaded: 40, total: 100 });
      if (gate) await gate;
      if (respond) { const r = respond(); if (r.status >= 400) fail(r.status, r.data); return ok(r.data, r.status); }
      return ok({ success: true, data: { ...UPLOADED } }, config.method === 'post' ? 201 : 200);
    }
    return ok({ success: true, data: [] });
  };
});
afterEach(cleanup);

const png = (over = {}) => new File([new Uint8Array(1200)], over.name || 'photo.png', { type: 'image/png' });
const fileInput = () => screen.getByLabelText('Upload from this device');
const choose = (file) => fireEvent.change(fileInput(), { target: { files: [file] } });

async function openServices() {
  render(<MemoryRouter initialEntries={['/admin']}><App /></MemoryRouter>);
  await screen.findByRole('tab', { name: 'Services' }); // the developer's only tab, already selected
  await screen.findByText('Gel Manicure');
}
const openAdd = async () => { await openServices(); fireEvent.click(screen.getByRole('button', { name: 'Add service' })); await screen.findByLabelText('Upload from this device'); };
const openEdit = async (name = 'Gel Manicure') => {
  await openServices();
  const row = screen.getByText(name).closest('li');
  fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
  await screen.findByLabelText('Upload from this device');
};
const fillRequired = () => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hot Stone Massage' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Relaxing massage' } });
  fireEvent.change(screen.getByLabelText(/Price/), { target: { value: '900' } });
};
const save = () => screen.getByRole('button', { name: /Save service|Saving/ });

describe('Add service', () => {
  it('shows a file input that accepts images (phone: gallery or camera) and no image yet', async () => {
    await openAdd();
    const input = fileInput();
    expect(input.type).toBe('file');
    expect(input.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(screen.getByText('No image selected')).toBeTruthy();
    expect(screen.getByText(/JPG, PNG or WebP, up to 5 MB/)).toBeTruthy();
  });

  it('previews the chosen image before saving and disables the manual path while a file is selected', async () => {
    await openAdd();
    choose(png());
    const img = await screen.findByAltText('Preview of the new image');
    expect(img.getAttribute('src')).toBe('blob:preview-1');
    expect(screen.getByText(/saved when you press Save service/)).toBeTruthy();
    expect(screen.getByLabelText('Or image path / URL').disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected image' }));
    await waitFor(() => expect(screen.getByText('No image selected')).toBeTruthy());
    expect(screen.getByLabelText('Or image path / URL').disabled).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });

  it('rejects wrong file types and oversized files immediately, with a clear message and no preview', async () => {
    await openAdd();
    choose(new File(['x'], 'anim.gif', { type: 'image/gif' }));
    expect(await screen.findByText('Choose a JPG, PNG or WebP image.')).toBeTruthy();
    expect(screen.queryByAltText('Preview of the new image')).toBeNull();
    choose(new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(screen.getByText('Choose a JPG, PNG or WebP image.')).toBeTruthy();
    choose(new File(['x'], 'photo.png', { type: 'text/html' })); // MIME not an image
    expect(screen.getByText('Choose a JPG, PNG or WebP image.')).toBeTruthy();
    const big = png(); Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
    choose(big);
    expect(await screen.findByText(/larger than 5 MB/)).toBeTruthy();
    expect(screen.queryByAltText('Preview of the new image')).toBeNull();
  });

  it('uploads with multipart FormData: file + all service fields, booleans as true/false text', async () => {
    await openAdd();
    fillRequired();
    choose(png());
    fireEvent.click(save());
    await waitFor(() => expect(requests.length).toBe(1));
    const r = requests[0];
    expect(r.method).toBe('post');
    expect(r.url).toBe('/admin/services');
    expect(r.isForm).toBe(true);
    expect(r.fields.imageFile).toBeInstanceOf(File);
    expect(r.fields.imageFile.name).toBe('photo.png');
    expect(r.fields).toMatchObject({ name: 'Hot Stone Massage', description: 'Relaxing massage', price: '900', durationMinutes: '60', category: 'nail-services', isStartingPrice: 'false', active: 'true', image: '' });
    // The client must not force a JSON content type; the browser adds the multipart boundary itself.
    expect(String(r.headers['Content-Type'] || '')).not.toMatch(/application\/json/);
    await waitFor(() => expect(screen.queryByLabelText('Upload from this device')).toBeNull()); // form closed
  });

  it('still works with no image, and with a manually typed path', async () => {
    await openAdd();
    fillRequired();
    fireEvent.change(screen.getByLabelText('Or image path / URL'), { target: { value: '/images/service-art.svg' } });
    fireEvent.click(save());
    await waitFor(() => expect(requests.length).toBe(1));
    expect(requests[0].fields.imageFile).toBeUndefined();
    expect(requests[0].fields.image).toBe('/images/service-art.svg');
  });

  it('shows progress while uploading, blocks duplicate submits, and locks the form', async () => {
    let release;
    gate = new Promise((r) => { release = r; });
    await openAdd();
    fillRequired();
    choose(png());
    const btn = save();
    fireEvent.click(btn); fireEvent.click(btn); fireEvent.click(btn);
    const bar = await screen.findByRole('progressbar', { name: 'Upload progress' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(screen.getByText('Uploading… 40%')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
    expect(fileInput().disabled).toBe(true);
    await act(async () => { release(); });
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(requests.length).toBe(1);
  });

  it('an upload rejected by the server shows the reason by the image and keeps the form for another try', async () => {
    respond = () => ({ status: 413, data: { success: false, code: 'IMAGE_TOO_LARGE', message: 'The image is too large. Please choose a file of 5 MB or less.' } });
    await openAdd();
    fillRequired();
    choose(png());
    fireEvent.click(save());
    expect(await screen.findByText('The image is too large. Please choose a file of 5 MB or less.')).toBeTruthy();
    expect(screen.getByLabelText('Name').value).toBe('Hot Stone Massage'); // nothing lost
    expect(screen.getByAltText('Preview of the new image')).toBeTruthy(); // selection kept
    expect(save().disabled).toBe(false);
  });

  it('other server errors are shown at the top of the form', async () => {
    respond = () => ({ status: 400, data: { success: false, message: 'Please correct the highlighted fields.', errors: { price: 'Number must be greater than or equal to 0' } } });
    await openAdd();
    fillRequired();
    fireEvent.click(save());
    expect(await screen.findByText('Number must be greater than or equal to 0')).toBeTruthy();
  });
});

describe('Edit service', () => {
  it('shows the saved uploaded image', async () => {
    await openEdit();
    const img = screen.getByAltText('Current service image');
    expect(img.getAttribute('src')).toBe(UPLOADED.image);
    expect(screen.getByText(/Choose a file below to replace it/)).toBeTruthy();
  });

  it('shows manually supplied paths (frontend assets) exactly as before', async () => {
    await openEdit('Classic Manicure');
    expect(screen.getByAltText('Current service image').getAttribute('src')).toBe('/images/service-manicure.svg');
    expect(screen.getByLabelText('Or image path / URL').value).toBe('/images/service-manicure.svg');
  });

  it('with no new file: no file is sent and the current image path is sent back so it is preserved', async () => {
    await openEdit();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gel Manicure Deluxe' } });
    fireEvent.click(save());
    await waitFor(() => expect(requests.length).toBe(1));
    expect(requests[0].method).toBe('put');
    expect(requests[0].url).toBe('/admin/services/svc1');
    expect(requests[0].fields.imageFile).toBeUndefined();
    expect(requests[0].fields.image).toBe(UPLOADED.image);
    expect(requests[0].fields.active).toBe('true');
  });

  it('a replacement is previewed in place of the current image and sent as the file', async () => {
    await openEdit();
    choose(png({ name: 'new.png' }));
    const preview = await screen.findByAltText('Preview of the new image');
    expect(preview.getAttribute('src')).toBe('blob:preview-1');
    expect(screen.queryByAltText('Current service image')).toBeNull();
    fireEvent.click(save());
    await waitFor(() => expect(requests.length).toBe(1));
    expect(requests[0].fields.imageFile.name).toBe('new.png');
  });

  it('inactive / "from price" flags are sent faithfully (not all turned into true)', async () => {
    await openEdit('Classic Manicure');
    fireEvent.click(save());
    await waitFor(() => expect(requests.length).toBe(1));
    expect(requests[0].fields.active).toBe('false');
    expect(requests[0].fields.isStartingPrice).toBe('true');
  });
});

describe('state resets correctly', () => {
  it('Cancel discards the selected file and preview', async () => {
    await openEdit();
    choose(png());
    await screen.findByAltText('Preview of the new image');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByLabelText('Upload from this device')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Add service' }));
    await screen.findByLabelText('Upload from this device');
    expect(screen.queryByAltText('Preview of the new image')).toBeNull();
    expect(screen.getByText('No image selected')).toBeTruthy();
    expect(fileInput().files.length).toBe(0);
    expect(requests.length).toBe(0);
  });

  it('opening a different service never carries over the previous selection or image', async () => {
    await openEdit('Gel Manicure');
    choose(png());
    await screen.findByAltText('Preview of the new image');
    const row = screen.getByText('Classic Manicure').closest('li');
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByAltText('Current service image').getAttribute('src')).toBe('/images/service-manicure.svg'));
    expect(screen.queryByAltText('Preview of the new image')).toBeNull();
    expect(fileInput().files.length).toBe(0);
  });

  it('after a successful save, reopening Add starts clean', async () => {
    await openAdd();
    fillRequired();
    choose(png());
    fireEvent.click(save());
    await waitFor(() => expect(screen.queryByLabelText('Upload from this device')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Add service' }));
    await screen.findByLabelText('Upload from this device');
    expect(screen.queryByAltText('Preview of the new image')).toBeNull();
    expect(screen.getByLabelText('Name').value).toBe('');
  });
});

describe('public image URLs', () => {
  it('manual paths, uploaded paths and full URLs all resolve (dev: same origin through the proxy)', async () => {
    const { resolveImageUrl } = await import('../src/lib/api');
    expect(resolveImageUrl('/images/service-gel.svg')).toBe('/images/service-gel.svg');
    expect(resolveImageUrl('/uploads/services/abc.png')).toBe('/uploads/services/abc.png');
    expect(resolveImageUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(resolveImageUrl('')).toBe('');
    expect(resolveImageUrl(undefined)).toBe('');
  });

  it('in production the uploaded path is loaded from the API origin', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api');
    vi.resetModules();
    const { resolveImageUrl } = await import('../src/lib/api');
    expect(resolveImageUrl('/uploads/services/abc.png')).toBe('https://api.example.com/uploads/services/abc.png');
    expect(resolveImageUrl('/images/service-gel.svg')).toBe('/images/service-gel.svg');
    vi.unstubAllEnvs();
  });
});
