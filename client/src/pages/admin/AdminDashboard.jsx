import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Seo from "../../components/Seo";
import Logo from "../../components/Logo";
import { ErrorBox, Spinner } from "../../components/ui";
import { categories, categoryLabel } from "../../config/categories";
import {
  adminLogout,
  api,
  formatDuration,
  formatPrice,
  parseError,
  resolveImageUrl,
} from "../../lib/api";
import ApiLoadingBar from "../../components/ApiLoadingBar";

const STATUSES = ["pending", "confirmed", "completed", "cancelled"];
const badge = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-700",
};

function useAdminData(url, params) {
  const [s, setS] = useState({ data: null, loading: true, error: "" });
  const key = JSON.stringify(params || {});
  const load = useCallback(async () => {
    setS((x) => ({ ...x, loading: true, error: "" }));
    try {
      const res = await api.get(url, { params: JSON.parse(key) });
      setS({ data: res.data.data, loading: false, error: "" });
    } catch (err) {
      const p = parseError(err);
      if (p.status === 401 || p.code === "NOT_ADMIN") return; // the API client is already sending the user to the login page
      setS({ data: null, loading: false, error: p.message });
    }
  }, [url, key]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...s, reload: load };
}

function Appointments() {
  const [filters, setFilters] = useState({
    date: "",
    status: "",
    category: "",
  });
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v),
  );
  const { data, loading, error, reload } = useAdminData(
    "/admin/appointments",
    params,
  );
  const [msg, setMsg] = useState("");

  const statusLocks = useRef(new Set());

  async function setStatus(id, status) {
    if (statusLocks.current.has(id)) return;

    statusLocks.current.add(id);
    setMsg("");

    try {
      await api.patch(`/admin/appointments/${id}/status`, {
        status,
      });

      await reload();
    } catch (err) {
      setMsg(parseError(err).message);
    } finally {
      statusLocks.current.delete(id);
    }
  }

  async function resendEmail(id) {
    setMsg("");
    try {
      const res = await api.post(`/admin/appointments/${id}/resend-email`);
      setMsg(res.data.message);
      reload();
    } catch (err) {
      setMsg(parseError(err).message);
    }
  }

  return (
    <div>
      <ApiLoadingBar />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="f-date">
            Date
          </label>
          <input
            id="f-date"
            type="date"
            className="input"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="f-status">
            Status
          </label>
          <select
            id="f-status"
            className="input"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-cat">
            Category
          </label>
          <select
            id="f-cat"
            className="input"
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <option value="">All (nail + spa)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => setFilters({ date: "", status: "", category: "" })}
        >
          Clear
        </button>
      </div>
      {msg && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {msg}
        </p>
      )}
      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data?.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft">
          No appointments match these filters.
        </p>
      )}
      {data?.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-brand-50 text-xs">
              <tr>
                {[
                  "Ref",
                  "When",
                  "Customer",
                  "Service",
                  "Tech",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((a) => (
                <tr key={a._id} className="align-top">
                  <td className="px-3 py-2 font-mono text-xs">{a.reference}</td>
                  <td className="px-3 py-2">
                    {a.date}
                    <br />
                    <span className="text-ink-soft">{a.timeLabel}</span>
                  </td>
                  <td className="px-3 py-2">
                    {a.customerName}
                    <br />
                    <a
                      className="text-xs text-brand-600"
                      href={`mailto:${a.email}`}
                    >
                      {a.email}
                    </a>
                    <br />
                    <a
                      className="text-xs text-ink-soft"
                      href={`tel:${a.phone}`}
                    >
                      {a.phone}
                    </a>
                    <br />
                    {a.emailVerified ? (
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        Email verified
                      </span>
                    ) : (
                      <span
                        className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                        title="Booked before email verification existed"
                      >
                        Email not verified
                      </span>
                    )}
                    {a.notes && (
                      <p className="mt-1 max-w-[200px] text-xs italic text-ink-soft">
                        “{a.notes}”
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {a.serviceName}
                    <br />
                    <span
                      className={`mr-1 rounded-full px-2 py-0.5 text-xs ${a.treatmentType === "spa" ? "bg-purple-100 text-purple-800" : "bg-pink-100 text-pink-800"}`}
                    >
                      {a.treatmentType === "spa" ? "Spa" : "Nail"}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {a.categoryLabel} · {formatDuration(a.durationMinutes)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{a.technicianName}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${badge[a.status]}`}
                    >
                      {a.status}
                    </span>
                    {(a.status === "pending" || a.status === "confirmed") &&
                      a.emailVerified &&
                      (() => {
                        const notice =
                          a.status === "confirmed"
                            ? a.confirmedEmail
                            : a.bookingEmail;
                        const label = {
                          sent: "Email sent",
                          failed: "Email failed",
                          not_configured: "Email not set up",
                          not_sent: "Email not sent",
                        }[notice.status];
                        return (
                          <p className="mt-1 text-xs text-ink-soft">
                            <span
                              className={
                                notice.status === "failed"
                                  ? "font-medium text-red-600"
                                  : ""
                              }
                            >
                              {label}
                            </span>
                            {notice.status !== "sent" && (
                              <button
                                type="button"
                                className="ml-1 text-brand-600 underline"
                                onClick={() => resendEmail(a._id)}
                              >
                                Resend
                              </button>
                            )}
                          </p>
                        );
                      })()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {a.status === "pending" && a.emailVerified && (
                        <button
                          className="btn btn-primary !px-3 !py-1 !text-xs"
                          onClick={() => setStatus(a._id, "confirmed")}
                        >
                          Confirm
                        </button>
                      )}
                      {a.status === "pending" && !a.emailVerified && (
                        <span className="max-w-[150px] text-xs text-ink-soft">
                          Cannot confirm: email never verified
                        </span>
                      )}
                      {a.status === "confirmed" && (
                        <button
                          className="btn btn-outline !px-3 !py-1 !text-xs"
                          onClick={() => setStatus(a._id, "completed")}
                        >
                          Complete
                        </button>
                      )}
                      {(a.status === "pending" || a.status === "confirmed") && (
                        <button
                          className="btn btn-outline !border-red-400 !px-3 !py-1 !text-xs !text-red-600"
                          onClick={() =>
                            window.confirm(
                              `Cancel ${a.reference}? This frees the time slot.`,
                            ) && setStatus(a._id, "cancelled")
                          }
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const blank = {
  name: "",
  category: "nail-services",
  description: "",
  price: "",
  durationMinutes: 60,
  isStartingPrice: false,
  active: true,
  image: "",
  sortOrder: 0,
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function Services({ canManage }) {
  const { data, loading, error, reload } = useAdminData("/admin/services");
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [imageFile, setImageFile] = useState(null); // newly chosen image (not saved yet)
  const [preview, setPreview] = useState("");
  const [fileKey, setFileKey] = useState(0); // changing it empties the <input type="file">
  const [imgError, setImgError] = useState("");
  const [progress, setProgress] = useState(null); // 0-100 while uploading
  const submitLock = useRef(false);

  // Local preview of the chosen file; the object URL is released when it changes or the form closes.
  useEffect(() => {
    if (!imageFile) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const clearFile = () => {
    setImageFile(null);
    setFileKey((k) => k + 1);
  };
  function openForm(service) {
    // Add (blank) or Edit: always start with a clean image state
    if (!canManage) return; // UI convenience only: the API refuses these requests for a business admin anyway
    setMsg("");
    setImgError("");
    setProgress(null);
    clearFile();
    setEditing(service);
  }
  function closeForm() {
    if (busy) return;
    setImgError("");
    setProgress(null);
    clearFile();
    setEditing(null);
  }
  function pickFile(e) {
    const file = e.target.files?.[0];
    setImgError("");
    if (!file) {
      clearFile();
      return;
    }
    if (
      !IMAGE_TYPES.includes(file.type) ||
      !/\.(jpe?g|png|webp)$/i.test(file.name)
    ) {
      setImgError("Choose a JPG, PNG or WebP image.");
      clearFile();
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImgError(
        "That image is larger than 5 MB. Please choose a smaller one.",
      );
      clearFile();
      return;
    }
    setImageFile(file);
  }

  async function save(e) {
    e.preventDefault();
    if (!canManage || busy || submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setMsg("");
    setImgError("");
    setProgress(imageFile ? 0 : null);
    try {
      // multipart/form-data: the browser sets the Content-Type (with boundary) itself
      const form = new FormData();
      form.append("name", editing.name);
      form.append("category", editing.category);
      form.append("description", editing.description);
      form.append("price", String(Number(editing.price)));
      form.append("durationMinutes", String(Number(editing.durationMinutes)));
      form.append("sortOrder", String(Number(editing.sortOrder)));
      form.append("isStartingPrice", String(Boolean(editing.isStartingPrice)));
      form.append("active", String(Boolean(editing.active)));
      form.append("image", editing.image || ""); // manual path / current image (ignored by the server when a file is sent)
      if (imageFile) form.append("imageFile", imageFile);
      const config = {
        onUploadProgress: (ev) => {
          if (imageFile && ev.total)
            setProgress(Math.round((ev.loaded * 100) / ev.total));
        },
      };
      if (editing._id)
        await api.put(`/admin/services/${editing._id}`, form, config);
      else await api.post("/admin/services", form, config);
      closeFormAfterSave();
      reload();
    } catch (err) {
      const p = parseError(err);
      const code = err.response?.data?.code || "";
      if (
        code.startsWith("INVALID_IMAGE") ||
        code === "IMAGE_TOO_LARGE" ||
        code === "UPLOAD_ERROR"
      )
        setImgError(p.message);
      else setMsg(Object.values(p.fieldErrors || {})[0] || p.message);
    } finally {
      submitLock.current = false;
      setBusy(false);
      setProgress(null);
    }
  }
  function closeFormAfterSave() {
    setImgError("");
    clearFile();
    setEditing(null);
  }
  async function remove(s) {
    if (!canManage || !window.confirm(`Delete "${s.name}"?`)) return;
    try {
      await api.delete(`/admin/services/${s._id}`);
      reload();
    } catch (err) {
      setMsg(parseError(err).message);
    }
  }

  return (
    <div>
      {canManage ? (
        <button
          className="btn btn-primary mb-4"
          onClick={() => openForm({ ...blank })}
        >
          Add service
        </button>
      ) : (
        <p
          className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-ink-soft"
          data-testid="services-readonly-note"
        >
          Your services are shown below. They are managed by your website
          maintainer: to change a price, description, image or add a new
          service, please contact them.
        </p>
      )}
      {msg && !editing && (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {msg}
        </p>
      )}
      {canManage && editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={editing._id ? "Edit service" : "Add service"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeForm();
          }}
        >
          <form
            onSubmit={save}
            onMouseDown={(e) => e.stopPropagation()}
            className="grid max-h-[90vh] w-full max-w-3xl gap-3 overflow-y-auto rounded-xl bg-brand-50 p-4 shadow-2xl sm:grid-cols-2 sm:p-6"
          >
            {msg && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-2 text-sm text-red-700 sm:col-span-2"
              >
                {msg}
              </p>
            )}
            <div>
              <label className="label" htmlFor="s-name">
                Name
              </label>
              <input
                id="s-name"
                required
                className="input"
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="s-cat">
                Category
              </label>
              <select
                id="s-cat"
                className="input"
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value })
                }
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 rounded-xl border border-brand-100 bg-white p-3">
              <p className="label !mb-2">Service image</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 sm:w-44">
                  {preview || editing.image ? (
                    <img
                      src={preview || resolveImageUrl(editing.image)}
                      alt={
                        preview
                          ? "Preview of the new image"
                          : "Current service image"
                      }
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <span className="px-2 text-center text-xs text-ink-mute">
                      No image selected
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-2 text-sm">
                  {preview && (
                    <p className="text-xs font-medium text-brand-600">
                      New image selected. It is saved when you press Save
                      service.
                    </p>
                  )}
                  {!preview && editing.image && (
                    <p className="text-xs text-ink-soft">
                      Current image. Choose a file below to replace it.
                    </p>
                  )}
                  <div>
                    <label className="label" htmlFor="s-file">
                      Upload from this device
                    </label>
                    <input
                      key={fileKey}
                      id="s-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={pickFile}
                      aria-describedby="s-file-hint"
                      className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
                    />
                    <p id="s-file-hint" className="mt-1 text-xs text-ink-mute">
                      JPG, PNG or WebP, up to 5 MB. On a phone you can pick a
                      photo or take one.
                    </p>
                    {imageFile && !busy && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-brand-600 underline"
                        onClick={clearFile}
                      >
                        Remove selected image
                      </button>
                    )}
                    {imgError && (
                      <p role="alert" className="mt-1 text-xs text-red-600">
                        {imgError}
                      </p>
                    )}
                  </div>
                  {progress !== null && (
                    <div>
                      <div className="h-2 overflow-hidden rounded-full bg-brand-100">
                        <div
                          role="progressbar"
                          aria-label="Upload progress"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progress}
                          className="h-full bg-brand-gradient transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        {progress < 100 ? `Uploading… ${progress}%` : "Saving…"}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="label" htmlFor="s-img">
                      Or image path / URL
                    </label>
                    <input
                      id="s-img"
                      className="input"
                      placeholder="/images/service-gel.svg"
                      disabled={!!imageFile || busy}
                      value={editing.image}
                      onChange={(e) =>
                        setEditing({ ...editing, image: e.target.value })
                      }
                    />
                    {imageFile && (
                      <p className="mt-1 text-xs text-ink-mute">
                        The uploaded file will be used instead of this path.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="s-desc">
                Description
              </label>
              <textarea
                id="s-desc"
                required
                rows={2}
                className="input"
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="s-price">
                Price (₱)
              </label>
              <input
                id="s-price"
                required
                type="number"
                min="0"
                className="input"
                value={editing.price}
                onChange={(e) =>
                  setEditing({ ...editing, price: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="s-dur">
                Duration (minutes)
              </label>
              <input
                id="s-dur"
                required
                type="number"
                min="15"
                max="480"
                step="5"
                className="input"
                value={editing.durationMinutes}
                onChange={(e) =>
                  setEditing({ ...editing, durationMinutes: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="s-order">
                Sort order
              </label>
              <input
                id="s-order"
                type="number"
                className="input"
                value={editing.sortOrder}
                onChange={(e) =>
                  setEditing({ ...editing, sortOrder: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-5 pt-6 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.isStartingPrice}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      isStartingPrice: e.target.checked,
                    })
                  }
                />{" "}
                “From” price
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                />{" "}
                Active
              </label>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save service"}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={closeForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4 max-w-xs">
        <label className="label" htmlFor="s-filter">
          Show category
        </label>
        <select
          id="s-filter"
          className="input"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data?.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft">
          {canManage
            ? "No services yet. Add your first one."
            : "No services to show yet."}
        </p>
      )}
      {data &&
        data.length > 0 &&
        data.filter((s) => !catFilter || s.category === catFilter).length ===
          0 && (
          <p className="py-8 text-center text-sm text-ink-soft">
            No services in this category.
          </p>
        )}
      {data?.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {data
            .filter((s) => !catFilter || s.category === catFilter)
            .map((s) => (
              <li
                key={s._id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  {s.image ? (
                    <img
                      src={resolveImageUrl(s.image)}
                      alt=""
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-lg bg-brand-50 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <span
                      className="h-10 w-10 shrink-0 rounded-lg bg-brand-50"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <p className="font-semibold">
                      {s.name}{" "}
                      {!s.active && (
                        <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs">
                          inactive
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {categoryLabel(s.category)} ·{" "}
                      {formatPrice(s.price, s.isStartingPrice)} ·{" "}
                      {formatDuration(s.durationMinutes)}
                    </p>
                    {s.description && (
                      <p className="mt-0.5 line-clamp-2 max-w-xl text-xs text-ink-mute">
                        {s.description}
                      </p>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button
                      className="btn btn-outline !px-3 !py-1 !text-xs"
                      onClick={() => openForm({ ...s })}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-outline !border-red-400 !px-3 !py-1 !text-xs !text-red-600"
                      onClick={() => remove(s)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Messages() {
  const { data, loading, error, reload } = useAdminData("/admin/messages");
  async function markRead(id) {
    try {
      await api.patch(`/admin/messages/${id}/read`);
      reload();
    } catch {
      /* shown on reload */
    }
  }
  return (
    <div>
      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data?.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft">
          No messages yet.
        </p>
      )}
      <ul className="space-y-3">
        {data?.map((m) => (
          <li
            key={m._id}
            className={`rounded-xl border p-4 text-sm ${m.read ? "border-slate-200" : "border-brand-300 bg-brand-50"}`}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">{m.subject}</p>
              <time className="text-xs text-ink-soft" dateTime={m.createdAt}>
                {new Date(m.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="text-xs text-ink-soft">
              {m.name} ·{" "}
              <a className="text-brand-600" href={`mailto:${m.email}`}>
                {m.email}
              </a>
            </p>
            <p className="mt-2 whitespace-pre-wrap">{m.message}</p>
            {!m.read && (
              <button
                className="btn btn-outline mt-3 !px-3 !py-1 !text-xs"
                onClick={() => markRead(m._id)}
              >
                Mark as read
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const ROLE_LABELS = { admin: "Business admin", developer: "Developer" };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { admin } = useOutletContext(); // role + permissions as reported by the server
  const allowed = (permission) =>
    Boolean(admin?.permissions?.includes(permission));
  // Hiding a tab is only a convenience. Every one of these actions is enforced again by the API.
  const tabs = [
    allowed("appointments:read") && ["appointments", "Appointments"],
    allowed("services:read") && ["services", "Services"],
    allowed("messages:read") && ["messages", "Messages"],
  ].filter(Boolean);
  const [chosen, setTab] = useState(null);
  const tab = tabs.some(([id]) => id === chosen) ? chosen : tabs[0]?.[0];
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }
  return (
    <div className="min-h-screen bg-white">
      <Seo title="Admin dashboard" noindex />
      <header className="border-b border-slate-100">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <Logo small plain />
          <div className="flex items-center gap-3">
            <span
              className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 sm:inline"
              data-testid="role-badge"
            >
              {ROLE_LABELS[admin?.role] || "Admin"}
            </span>
            <button
              className="btn btn-outline !py-1.5"
              disabled={signingOut}
              onClick={signOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>
      <div className="container-page py-6">
        <p className="mb-3 text-xs text-ink-soft sm:hidden">
          {ROLE_LABELS[admin?.role] || "Admin"}
        </p>
        {tabs.length === 0 && (
          <p
            role="alert"
            className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"
          >
            This account has no dashboard sections assigned.
          </p>
        )}
        <div
          role="tablist"
          aria-label="Admin sections"
          className="mb-6 flex gap-2 overflow-x-auto border-b border-slate-100"
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? "border-brand-500 text-brand-600" : "border-transparent text-ink-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === "appointments" ? (
            <Appointments />
          ) : tab === "services" ? (
            <Services canManage={allowed("services:write")} />
          ) : tab === "messages" ? (
            <Messages />
          ) : null}
        </div>
      </div>
    </div>
  );
}
