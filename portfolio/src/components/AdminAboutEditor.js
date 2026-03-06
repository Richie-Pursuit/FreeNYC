"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const CSRF_HEADER_NAME = "x-csrf-token";
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeText(value) {
  return typeof value === "string" ? value : "";
}

function normalizeSections(input = {}) {
  const hero = input?.hero || {};
  const header = input?.header || {};
  const body = input?.body || {};
  const quote = input?.quote || {};
  const contact = input?.contact || {};
  const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs.map(sanitizeText) : [];

  return {
    hero: {
      imageUrl: sanitizeText(hero.imageUrl),
      publicId: sanitizeText(hero.publicId),
      alt: sanitizeText(hero.alt),
    },
    header: {
      introLabel: sanitizeText(header.introLabel),
      headline: sanitizeText(header.headline),
      supportingLine: sanitizeText(header.supportingLine),
    },
    body: {
      paragraphs: paragraphs.length > 0 ? paragraphs : [""],
    },
    quote: {
      text: sanitizeText(quote.text),
      attribution: sanitizeText(quote.attribution),
    },
    contact: {
      instagramLabel: sanitizeText(contact.instagramLabel),
      instagramHandle: sanitizeText(contact.instagramHandle),
      instagramUrl: sanitizeText(contact.instagramUrl),
      emailLabel: sanitizeText(contact.emailLabel),
      email: sanitizeText(contact.email),
    },
  };
}

function areSectionsEqual(left, right) {
  if (!left || !right) {
    return false;
  }
  return JSON.stringify(normalizeSections(left)) === JSON.stringify(normalizeSections(right));
}

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || "Request failed.");
  }
  return data;
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 shadow-[0_12px_34px_rgba(0,0,0,0.05)] sm:p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-foreground/75">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function AdminAboutEditor() {
  const fileInputRef = useRef(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [savedSections, setSavedSections] = useState(null);
  const [draftSections, setDraftSections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");

  const isDirty = useMemo(
    () => Boolean(savedSections && draftSections) && !areSectionsEqual(savedSections, draftSections),
    [draftSections, savedSections],
  );

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const refreshCsrfToken = useCallback(async () => {
    const csrfData = await fetch("/api/csrf", { cache: "no-store" }).then(parseJsonResponse);
    const token = sanitizeText(csrfData.csrfToken);
    setCsrfToken(token);
    return token;
  }, []);

  const ensureCsrfToken = useCallback(async () => {
    if (csrfToken) {
      return csrfToken;
    }
    return refreshCsrfToken();
  }, [csrfToken, refreshCsrfToken]);

  const fetchWithCsrf = useCallback(
    async (url, options = {}) => {
      const makeRequest = async (token) => {
        const headers = new Headers(options.headers || {});
        headers.set(CSRF_HEADER_NAME, token);
        return fetch(url, { ...options, headers });
      };

      let token = await ensureCsrfToken();
      let response = await makeRequest(token);

      if (response.status === 403) {
        token = await refreshCsrfToken();
        response = await makeRequest(token);
      }

      return response;
    },
    [ensureCsrfToken, refreshCsrfToken],
  );

  const loadAboutContent = useCallback(async () => {
    setLoading(true);
    setStatus("idle");
    setMessage("");
    try {
      const [pageData, csrfData] = await Promise.all([
        fetch("/api/pages/about", { cache: "no-store" }).then(parseJsonResponse),
        fetch("/api/csrf", { cache: "no-store" }).then(parseJsonResponse),
      ]);

      const normalizedSections = normalizeSections(pageData?.page?.sections || {});
      setSavedSections(normalizedSections);
      setDraftSections(clone(normalizedSections));
      setCsrfToken(sanitizeText(csrfData.csrfToken));
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Unable to load About page content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAboutContent();
  }, [loadAboutContent]);

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const updateSection = useCallback((sectionName, fieldName, value) => {
    setDraftSections((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [sectionName]: {
          ...current[sectionName],
          [fieldName]: value,
        },
      };
    });
  }, []);

  const updateParagraph = useCallback((index, value) => {
    setDraftSections((current) => {
      if (!current) {
        return current;
      }
      const nextParagraphs = [...current.body.paragraphs];
      nextParagraphs[index] = value;
      return {
        ...current,
        body: {
          ...current.body,
          paragraphs: nextParagraphs,
        },
      };
    });
  }, []);

  const addParagraph = useCallback(() => {
    setDraftSections((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        body: {
          ...current.body,
          paragraphs: [...current.body.paragraphs, ""],
        },
      };
    });
  }, []);

  const removeParagraph = useCallback((index) => {
    setDraftSections((current) => {
      if (!current) {
        return current;
      }
      const nextParagraphs = current.body.paragraphs.filter((_, paragraphIndex) => paragraphIndex !== index);
      return {
        ...current,
        body: {
          ...current.body,
          paragraphs: nextParagraphs.length > 0 ? nextParagraphs : [""],
        },
      };
    });
  }, []);

  const moveParagraph = useCallback((index, direction) => {
    setDraftSections((current) => {
      if (!current) {
        return current;
      }
      const nextParagraphs = [...current.body.paragraphs];
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= nextParagraphs.length) {
        return current;
      }
      const [moved] = nextParagraphs.splice(index, 1);
      nextParagraphs.splice(nextIndex, 0, moved);
      return {
        ...current,
        body: {
          ...current.body,
          paragraphs: nextParagraphs,
        },
      };
    });
  }, []);

  const handleImageFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        setStatus("error");
        setMessage("Image is too large. Max file size is 12MB.");
        event.target.value = "";
        return;
      }

      if (!file.type.startsWith("image/")) {
        setStatus("error");
        setMessage("Please choose a valid image file.");
        event.target.value = "";
        return;
      }

      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }

      const previewUrl = URL.createObjectURL(file);
      setSelectedImageFile(file);
      setLocalPreviewUrl(previewUrl);
      setStatus("idle");
      setMessage("Image selected. Upload and save to publish the change.");
    },
    [localPreviewUrl],
  );

  const uploadSelectedHeroImage = useCallback(async () => {
    if (!selectedImageFile) {
      return null;
    }

    const signaturePayload = await fetchWithCsrf("/api/upload/signature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folder: "freenyc/about" }),
    }).then(parseJsonResponse);

    const uploadFormData = new FormData();
    uploadFormData.append("file", selectedImageFile);
    uploadFormData.append("api_key", signaturePayload.apiKey);
    uploadFormData.append("timestamp", String(signaturePayload.timestamp));
    uploadFormData.append("signature", signaturePayload.signature);
    uploadFormData.append("folder", signaturePayload.folder);
    if (signaturePayload.allowedFormats) {
      uploadFormData.append("allowed_formats", signaturePayload.allowedFormats);
    }

    const cloudinaryResult = await fetch(signaturePayload.uploadUrl, {
      method: "POST",
      body: uploadFormData,
    });

    const cloudinaryData = await cloudinaryResult.json().catch(() => ({}));
    if (!cloudinaryResult.ok || !cloudinaryData.secure_url) {
      throw new Error(cloudinaryData.error?.message || "Cloudinary upload failed.");
    }

    const nextHeroImage = {
      imageUrl: cloudinaryData.secure_url,
      publicId: cloudinaryData.public_id || "",
    };

    setDraftSections((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        hero: {
          ...current.hero,
          imageUrl: nextHeroImage.imageUrl,
          publicId: nextHeroImage.publicId,
        },
      };
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedImageFile(null);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl("");

    return nextHeroImage;
  }, [fetchWithCsrf, localPreviewUrl, selectedImageFile]);

  const uploadHeroImage = useCallback(async () => {
    if (!selectedImageFile) {
      setStatus("error");
      setMessage("Choose an image first.");
      return;
    }

    setUploadingImage(true);
    setStatus("idle");
    setMessage("");
    try {
      await uploadSelectedHeroImage();
      setStatus("success");
      setMessage("Hero image uploaded. Save About page to publish.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Unable to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }, [selectedImageFile, uploadSelectedHeroImage]);

  const removeHeroImage = useCallback(() => {
    setDraftSections((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        hero: {
          ...current.hero,
          imageUrl: "",
          publicId: "",
        },
      };
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedImageFile(null);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl("");
  }, [localPreviewUrl]);

  const resetToSaved = useCallback(() => {
    if (!savedSections) {
      return;
    }
    setDraftSections(clone(savedSections));
    setStatus("idle");
    setMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedImageFile(null);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setLocalPreviewUrl("");
  }, [localPreviewUrl, savedSections]);

  const saveContent = useCallback(async () => {
    if (!draftSections) {
      return;
    }

    setSaving(true);
    setStatus("idle");
    setMessage("");
    try {
      let sectionsToSave = draftSections;

      if (selectedImageFile) {
        setUploadingImage(true);
        const uploadedHero = await uploadSelectedHeroImage();
        if (uploadedHero) {
          sectionsToSave = {
            ...sectionsToSave,
            hero: {
              ...sectionsToSave.hero,
              imageUrl: uploadedHero.imageUrl,
              publicId: uploadedHero.publicId,
            },
          };
        }
        setUploadingImage(false);
      }

      const response = await fetchWithCsrf("/api/pages/about", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sections: sectionsToSave }),
      }).then(parseJsonResponse);

      const normalizedSections = normalizeSections(response?.page?.sections || sectionsToSave);
      setSavedSections(normalizedSections);
      setDraftSections(clone(normalizedSections));
      setStatus("success");
      setMessage("About page saved.");
    } catch (error) {
      setUploadingImage(false);
      setStatus("error");
      setMessage(error.message || "Unable to save About content.");
    } finally {
      setSaving(false);
    }
  }, [draftSections, fetchWithCsrf, selectedImageFile, uploadSelectedHeroImage]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-foreground/80">Loading About editor...</p>
        </div>
      </main>
    );
  }

  if (!draftSections) {
    return (
      <main className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">
            {message || "Unable to load About editor. Refresh and try again."}
          </p>
        </div>
      </main>
    );
  }

  const previewImage = localPreviewUrl || draftSections.hero.imageUrl;
  const previewParagraphs = draftSections.body.paragraphs.filter((value) => value.trim());

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-8 text-[16px] text-foreground sm:px-8 sm:py-10 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] tracking-[0.18em] text-foreground/75 uppercase">Admin Workspace</p>
          <h1 className="display-font mt-2 text-4xl leading-none text-foreground sm:text-5xl">
            About Page Editor
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/80">
            Edit image, narrative, quote, and contact content for the public About page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="rounded-md border border-line bg-white px-4 py-2 text-[12px] font-semibold tracking-[0.12em] text-foreground uppercase transition-colors hover:border-foreground"
          >
            Back To Control Room
          </Link>
          <button
            type="button"
            onClick={resetToSaved}
            disabled={!isDirty || saving || uploadingImage}
            className="rounded-md border border-line bg-white px-4 py-2 text-[12px] font-semibold tracking-[0.12em] text-foreground uppercase transition-colors hover:border-foreground disabled:opacity-45"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={saveContent}
            disabled={!isDirty || saving || uploadingImage}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-[12px] font-semibold tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-45"
          >
            {saving ? "Saving..." : "Save About Page"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase ${
            isDirty
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {isDirty ? "Unsaved Changes" : "All Changes Saved"}
        </span>
        {message ? (
          <p className={`text-sm ${status === "error" ? "text-red-700" : "text-foreground/80"}`}>{message}</p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
        <div className="space-y-5">
          <SectionCard
            title="Hero Image"
            description="Upload or replace the About page portrait image, then save changes."
          >
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-xl border border-line bg-zinc-50 p-2">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-zinc-200">
                  {previewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewImage}
                      alt={draftSections.hero.alt || "About hero preview"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-foreground/60">
                      No image selected
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-foreground">Alt Text</label>
                  <input
                    type="text"
                    value={draftSections.hero.alt}
                    onChange={(event) => updateSection("hero", "alt", event.target.value)}
                    placeholder="Describe the image for accessibility"
                    className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                  />
                </div>

                <div className="rounded-lg border border-line bg-zinc-50 p-3">
                  <label className="mb-2 block text-sm font-semibold text-foreground">Replace Image</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:tracking-[0.12em] file:uppercase file:text-foreground"
                  />
                  <p className="mt-1.5 text-xs text-foreground/70">JPG, PNG, WEBP, AVIF. Max file size 12MB.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={uploadHeroImage}
                    disabled={!selectedImageFile || uploadingImage || saving}
                    className="rounded-md border border-foreground bg-foreground px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-45"
                  >
                    {uploadingImage ? "Uploading..." : "Upload / Replace"}
                  </button>
                  <button
                    type="button"
                    onClick={removeHeroImage}
                    disabled={uploadingImage || saving}
                    className="rounded-md border border-line bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.12em] text-foreground uppercase transition-colors hover:border-foreground disabled:opacity-45"
                  >
                    Remove Image
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Header" description="Top headline section content on the About page.">
            <div className="grid gap-3">
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Intro Label</span>
                <input
                  type="text"
                  value={draftSections.header.introLabel}
                  onChange={(event) => updateSection("header", "introLabel", event.target.value)}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Main Headline</span>
                <input
                  type="text"
                  value={draftSections.header.headline}
                  onChange={(event) => updateSection("header", "headline", event.target.value)}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Supporting Line</span>
                <textarea
                  value={draftSections.header.supportingLine}
                  onChange={(event) => updateSection("header", "supportingLine", event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base leading-7 text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title="Body Copy"
            description="Edit paragraphs as separate blocks for easier scanning and writing."
          >
            <div className="space-y-3">
              {draftSections.body.paragraphs.map((paragraph, index) => (
                <article key={`paragraph-editor-${index}`} className="rounded-lg border border-line bg-zinc-50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold tracking-[0.12em] text-foreground/75 uppercase">
                      Paragraph {index + 1}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => moveParagraph(index, "up")}
                        disabled={index === 0}
                        className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors hover:border-foreground disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveParagraph(index, "down")}
                        disabled={index === draftSections.body.paragraphs.length - 1}
                        className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors hover:border-foreground disabled:opacity-40"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => removeParagraph(index)}
                        className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold tracking-[0.08em] text-rose-700 uppercase transition-colors hover:border-rose-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={paragraph}
                    onChange={(event) => updateParagraph(index, event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base leading-7 text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                  />
                </article>
              ))}
              <button
                type="button"
                onClick={addParagraph}
                className="rounded-md border border-line bg-white px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-foreground uppercase transition-colors hover:border-foreground"
              >
                Add Paragraph
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Quote" description="Quote block and optional attribution line.">
            <div className="grid gap-3">
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Quote Text</span>
                <textarea
                  value={draftSections.quote.text}
                  onChange={(event) => updateSection("quote", "text", event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base leading-7 text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Attribution (Optional)</span>
                <input
                  type="text"
                  value={draftSections.quote.attribution}
                  onChange={(event) => updateSection("quote", "attribution", event.target.value)}
                  placeholder="Example: Richie Carrasco"
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Contact" description="Edit Instagram and email display/link information.">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Instagram Label</span>
                <input
                  type="text"
                  value={draftSections.contact.instagramLabel}
                  onChange={(event) => updateSection("contact", "instagramLabel", event.target.value)}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Instagram Handle</span>
                <input
                  type="text"
                  value={draftSections.contact.instagramHandle}
                  onChange={(event) => updateSection("contact", "instagramHandle", event.target.value)}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Instagram Link</span>
                <input
                  type="url"
                  value={draftSections.contact.instagramUrl}
                  onChange={(event) => updateSection("contact", "instagramUrl", event.target.value)}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Email Label</span>
                <input
                  type="text"
                  value={draftSections.contact.emailLabel}
                  onChange={(event) => updateSection("contact", "emailLabel", event.target.value)}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-foreground">Email Address</span>
                <input
                  type="email"
                  value={draftSections.contact.email}
                  onChange={(event) => updateSection("contact", "email", event.target.value)}
                  className="w-full rounded-lg border border-zinc-400 bg-white px-3.5 py-3 text-base text-foreground outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                />
              </label>
            </div>
          </SectionCard>
        </div>

        <aside className="xl:sticky xl:top-24 xl:h-fit">
          <section className="rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,245,240,0.95)_100%)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.1)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-foreground">Live Preview</h3>
              <span className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-zinc-700 uppercase">
                About Page
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-line bg-white">
              <div className="relative aspect-[4/5] w-full bg-zinc-200">
                {previewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewImage}
                    alt={draftSections.hero.alt || "About preview hero"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-foreground/65">
                    No hero image selected
                  </div>
                )}
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground/70 uppercase">
                    {draftSections.header.introLabel || "About the Artist"}
                  </p>
                  <h4 className="display-font mt-1 text-3xl leading-tight text-foreground">
                    {draftSections.header.headline || "Headline"}
                  </h4>
                  {draftSections.header.supportingLine ? (
                    <p className="mt-2 text-sm leading-6 text-foreground/85">
                      {draftSections.header.supportingLine}
                    </p>
                  ) : null}
                </div>

                {previewParagraphs.length > 0 ? (
                  <div className="space-y-2 border-t border-line pt-3 text-sm leading-6 text-foreground/85">
                    {previewParagraphs.map((paragraph, index) => (
                      <p key={`preview-paragraph-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                ) : null}

                {draftSections.quote.text ? (
                  <blockquote className="border border-line bg-zinc-50 px-3 py-3 text-sm leading-6 italic text-foreground/90">
                    “{draftSections.quote.text}”
                    {draftSections.quote.attribution ? (
                      <footer className="mt-2 text-[11px] not-italic tracking-[0.12em] text-foreground/70 uppercase">
                        {draftSections.quote.attribution}
                      </footer>
                    ) : null}
                  </blockquote>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-line bg-white px-3 py-2.5">
                    <p className="text-[10px] font-semibold tracking-[0.14em] text-foreground/70 uppercase">
                      {draftSections.contact.instagramLabel || "Instagram"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {draftSections.contact.instagramHandle || "@handle"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line bg-white px-3 py-2.5">
                    <p className="text-[10px] font-semibold tracking-[0.14em] text-foreground/70 uppercase">
                      {draftSections.contact.emailLabel || "Email"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {draftSections.contact.email || "name@example.com"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
