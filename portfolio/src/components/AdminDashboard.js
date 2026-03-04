"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

const defaultUploadForm = {
  title: "",
  caption: "",
  poem: "",
  collection: "City Life",
};

const baseCollections = [
  "Street Portraits",
  "Night Walks",
  "Subway Stories",
  "City Life",
];

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s/_-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

function toDraft(photo) {
  return {
    title: photo.title || "",
    caption: photo.caption || "",
    poem: photo.poem || "",
    collection: photo.collection || "City Life",
  };
}

function buildDraftMap(photos, previousDrafts = {}) {
  const nextDrafts = {};

  photos.forEach((photo) => {
    nextDrafts[photo.photoId] = previousDrafts[photo.photoId] || toDraft(photo);
  });

  return nextDrafts;
}

function mergeCollections(...values) {
  const flat = values
    .flat()
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return [...new Set(flat)].sort((a, b) => a.localeCompare(b));
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      (typeof data.error === "string" && data.error) ||
      (typeof data.error?.message === "string" && data.error.message) ||
      (typeof data.message === "string" && data.message) ||
      "Request failed.";
    throw new Error(errorMessage);
  }

  return data;
}

export default function AdminDashboard() {
  const [uploadForm, setUploadForm] = useState(defaultUploadForm);
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState("");

  const [manageStatus, setManageStatus] = useState("idle");
  const [manageMessage, setManageMessage] = useState("");

  const [photos, setPhotos] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [collections, setCollections] = useState(baseCollections);
  const [ready, setReady] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  const [savingPhotoId, setSavingPhotoId] = useState("");
  const [deletingPhotoId, setDeletingPhotoId] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);

  const isUploading = uploadStatus === "uploading";

  const collectionOptions = useMemo(
    () => mergeCollections(baseCollections, collections, photos.map((photo) => photo.collection)),
    [collections, photos],
  );

  const loadDashboardData = useCallback(async () => {
    setLoadingPhotos(true);

    try {
      const [uploadHealth, photoList] = await Promise.all([
        fetch("/api/upload", { cache: "no-store" }).then(parseJsonResponse),
        fetch("/api/photos?limit=200&sort=manual", { cache: "no-store" }).then(
          parseJsonResponse,
        ),
      ]);

      const nextPhotos = photoList.photos || [];
      setReady(Boolean(uploadHealth.ready));
      setPhotos(nextPhotos);
      setDrafts((current) => buildDraftMap(nextPhotos, current));
      setCollections((current) => mergeCollections(current, photoList.collections || []));
      setManageStatus("idle");
      setManageMessage("");
      setOrderDirty(false);
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to load admin dashboard data.");
    } finally {
      setLoadingPhotos(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleUploadChange = (event) => {
    const { name, value } = event.target;
    setUploadForm((current) => ({ ...current, [name]: value }));
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setUploadStatus("error");
      setUploadMessage("Choose a photo file before uploading.");
      return;
    }

    setUploadStatus("uploading");
    setUploadMessage("Uploading to Cloudinary...");

    try {
      const signaturePayload = await fetch("/api/upload/signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folder: `freenyc/${slugify(uploadForm.collection || "city-life")}`,
        }),
      }).then(parseJsonResponse);

      const cloudinaryForm = new FormData();
      cloudinaryForm.set("file", file);
      cloudinaryForm.set("api_key", signaturePayload.apiKey);
      cloudinaryForm.set("timestamp", String(signaturePayload.timestamp));
      cloudinaryForm.set("signature", signaturePayload.signature);
      if (signaturePayload.folder) {
        cloudinaryForm.set("folder", signaturePayload.folder);
      }

      const cloudinaryResult = await fetch(signaturePayload.uploadUrl, {
        method: "POST",
        body: cloudinaryForm,
      }).then(parseJsonResponse);

      setUploadMessage("Saving metadata...");

      await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secureUrl: cloudinaryResult.secure_url,
          publicId: cloudinaryResult.public_id,
          title: uploadForm.title || file.name.replace(/\.[a-zA-Z0-9]+$/, ""),
          caption: uploadForm.caption,
          poem: uploadForm.poem,
          collection: uploadForm.collection,
        }),
      }).then(parseJsonResponse);

      setFile(null);
      setUploadForm((current) => ({
        ...defaultUploadForm,
        collection: current.collection || defaultUploadForm.collection,
      }));
      setUploadStatus("success");
      setUploadMessage("Upload complete.");
      await loadDashboardData();
    } catch (error) {
      setUploadStatus("error");
      setUploadMessage(error.message || "Upload failed.");
    }
  };

  const handleDraftChange = (photoId, field, value) => {
    setDrafts((current) => ({
      ...current,
      [photoId]: {
        ...current[photoId],
        [field]: value,
      },
    }));
  };

  const handleSavePhoto = async (photoId) => {
    const draft = drafts[photoId];
    if (!draft) {
      return;
    }

    setSavingPhotoId(photoId);
    setManageStatus("idle");
    setManageMessage("");

    try {
      const payload = {
        title: draft.title,
        caption: draft.caption,
        poem: draft.poem,
        collection: draft.collection,
      };

      const result = await fetch(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then(parseJsonResponse);

      setPhotos((current) =>
        current.map((photo) => (photo.photoId === photoId ? result.photo : photo)),
      );
      setDrafts((current) => ({
        ...current,
        [photoId]: toDraft(result.photo),
      }));
      setCollections((current) => mergeCollections(current, [result.photo.collection]));
      setManageStatus("success");
      setManageMessage(`Saved ${result.photo.title || "photo"}.`);
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to save photo changes.");
    } finally {
      setSavingPhotoId("");
    }
  };

  const handleDeletePhoto = async (photo) => {
    const confirmed = window.confirm(`Delete \"${photo.title || "Untitled"}\"?`);
    if (!confirmed) {
      return;
    }

    setDeletingPhotoId(photo.photoId);
    setManageStatus("idle");
    setManageMessage("");

    try {
      await fetch(`/api/photos/${photo.photoId}`, {
        method: "DELETE",
      }).then(parseJsonResponse);

      setPhotos((current) => current.filter((item) => item.photoId !== photo.photoId));
      setDrafts((current) => {
        const next = { ...current };
        delete next[photo.photoId];
        return next;
      });
      setManageStatus("success");
      setManageMessage("Photo deleted.");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to delete photo.");
    } finally {
      setDeletingPhotoId("");
    }
  };

  const movePhoto = (photoId, direction) => {
    setPhotos((current) => {
      const index = current.findIndex((photo) => photo.photoId === photoId);
      if (index < 0) {
        return current;
      }

      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

    setOrderDirty(true);
    setManageStatus("idle");
    setManageMessage("");
  };

  const saveOrder = async () => {
    if (!orderDirty || photos.length === 0) {
      return;
    }

    setIsSavingOrder(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      const result = await fetch("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          photoIds: photos.map((photo) => photo.photoId),
        }),
      }).then(parseJsonResponse);

      const nextPhotos = result.photos || [];
      setPhotos(nextPhotos);
      setDrafts((current) => buildDraftMap(nextPhotos, current));
      setOrderDirty(false);
      setManageStatus("success");
      setManageMessage("Photo order saved.");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to save photo order.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-font text-5xl">Admin Panel</h1>
        <div className="text-right text-xs tracking-[0.14em] text-muted uppercase">
          <p>Cloudinary: {ready ? "Connected" : "Not Configured"}</p>
          <p className="mt-1">Total Photos: {photos.length}</p>
        </div>
      </div>

      <section className="mt-10 border border-line p-6">
        <h2 className="text-sm tracking-[0.14em] uppercase">Upload Photo</h2>

        <form onSubmit={handleUploadSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-xs tracking-[0.14em] text-muted uppercase md:col-span-2">
            Photo File
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-2 block w-full border border-line px-4 py-3 text-sm normal-case outline-none file:mr-4 file:border-0 file:bg-transparent file:text-xs file:tracking-[0.1em] file:uppercase focus:border-foreground"
              disabled={isUploading}
            />
          </label>

          <label className="text-xs tracking-[0.14em] text-muted uppercase">
            Title
            <input
              name="title"
              value={uploadForm.title}
              onChange={handleUploadChange}
              type="text"
              placeholder="Title"
              className="mt-2 w-full border border-line px-4 py-3 text-sm normal-case outline-none focus:border-foreground"
              disabled={isUploading}
            />
          </label>

          <label className="text-xs tracking-[0.14em] text-muted uppercase">
            Collection
            <input
              name="collection"
              list="collection-options"
              value={uploadForm.collection}
              onChange={handleUploadChange}
              type="text"
              placeholder="Collection"
              className="mt-2 w-full border border-line px-4 py-3 text-sm normal-case outline-none focus:border-foreground"
              disabled={isUploading}
            />
          </label>

          <label className="text-xs tracking-[0.14em] text-muted uppercase md:col-span-2">
            Caption
            <textarea
              name="caption"
              value={uploadForm.caption}
              onChange={handleUploadChange}
              rows={3}
              placeholder="Caption"
              className="mt-2 w-full border border-line px-4 py-3 text-sm normal-case outline-none focus:border-foreground"
              disabled={isUploading}
            />
          </label>

          <label className="text-xs tracking-[0.14em] text-muted uppercase md:col-span-2">
            Poem
            <textarea
              name="poem"
              value={uploadForm.poem}
              onChange={handleUploadChange}
              rows={4}
              placeholder="Poem"
              className="mt-2 w-full border border-line px-4 py-3 text-sm normal-case outline-none focus:border-foreground"
              disabled={isUploading}
            />
          </label>

          <button
            type="submit"
            className="w-max border border-foreground px-6 py-2 text-[11px] tracking-[0.18em] uppercase transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isUploading || !ready}
          >
            {isUploading ? "Uploading..." : "Submit"}
          </button>
        </form>

        {uploadMessage ? (
          <p
            className={`mt-4 text-sm ${
              uploadStatus === "error" ? "text-red-700" : "text-muted"
            }`}
          >
            {uploadMessage}
          </p>
        ) : null}
      </section>

      <section className="mt-10 border border-line p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm tracking-[0.14em] uppercase">Existing Photos</h2>
          <button
            type="button"
            onClick={saveOrder}
            disabled={!orderDirty || isSavingOrder}
            className="border border-foreground px-4 py-2 text-[11px] tracking-[0.16em] uppercase transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingOrder ? "Saving..." : "Save Order"}
          </button>
        </div>

        {manageMessage ? (
          <p
            className={`mt-4 text-sm ${
              manageStatus === "error" ? "text-red-700" : "text-muted"
            }`}
          >
            {manageMessage}
          </p>
        ) : null}

        {loadingPhotos ? (
          <p className="mt-4 text-sm text-muted">Loading photos...</p>
        ) : photos.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No photos yet.</p>
        ) : (
          <div className="mt-6 space-y-5">
            {photos.map((photo, index) => {
              const draft = drafts[photo.photoId] || toDraft(photo);
              const isSaving = savingPhotoId === photo.photoId;
              const isDeleting = deletingPhotoId === photo.photoId;

              return (
                <article
                  key={photo.photoId}
                  className="grid gap-4 border border-line p-4 lg:grid-cols-[180px_1fr]"
                >
                  <div className="space-y-3">
                    <div className="relative aspect-[4/5] overflow-hidden bg-zinc-200">
                      <Image
                        src={photo.thumbnailUrl || photo.imageUrl}
                        alt={photo.title || "Photo"}
                        fill
                        sizes="180px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => movePhoto(photo.photoId, "up")}
                        disabled={index === 0}
                        className="flex-1 border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => movePhoto(photo.photoId, "down")}
                        disabled={index === photos.length - 1}
                        className="flex-1 border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-40"
                      >
                        Down
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-[10px] tracking-[0.12em] text-muted uppercase">
                      Title
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(event) =>
                          handleDraftChange(photo.photoId, "title", event.target.value)
                        }
                        className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                        disabled={isSaving || isDeleting}
                      />
                    </label>

                    <label className="text-[10px] tracking-[0.12em] text-muted uppercase">
                      Collection
                      <input
                        type="text"
                        list="collection-options"
                        value={draft.collection}
                        onChange={(event) =>
                          handleDraftChange(photo.photoId, "collection", event.target.value)
                        }
                        className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                        disabled={isSaving || isDeleting}
                      />
                    </label>

                    <label className="text-[10px] tracking-[0.12em] text-muted uppercase md:col-span-2">
                      Caption
                      <textarea
                        rows={3}
                        value={draft.caption}
                        onChange={(event) =>
                          handleDraftChange(photo.photoId, "caption", event.target.value)
                        }
                        className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                        disabled={isSaving || isDeleting}
                      />
                    </label>

                    <label className="text-[10px] tracking-[0.12em] text-muted uppercase md:col-span-2">
                      Poem
                      <textarea
                        rows={4}
                        value={draft.poem}
                        onChange={(event) =>
                          handleDraftChange(photo.photoId, "poem", event.target.value)
                        }
                        className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                        disabled={isSaving || isDeleting}
                      />
                    </label>

                    <div className="mt-1 flex flex-wrap gap-2 md:col-span-2">
                      <button
                        type="button"
                        onClick={() => handleSavePhoto(photo.photoId)}
                        disabled={isSaving || isDeleting}
                        className="border border-foreground px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo)}
                        disabled={isSaving || isDeleting}
                        className="border border-red-600 px-4 py-2 text-[10px] tracking-[0.14em] text-red-700 uppercase transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <datalist id="collection-options">
        {collectionOptions.map((collection) => (
          <option key={collection} value={collection} />
        ))}
      </datalist>
    </main>
  );
}
