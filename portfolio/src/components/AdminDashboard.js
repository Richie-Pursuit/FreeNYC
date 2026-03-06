"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const CSRF_HEADER_NAME = "x-csrf-token";
const PAGE_SIZE_OPTIONS = [24, 48, 96];
const HOMEPAGE_MAX_PHOTOS = 100;
const LIBRARY_SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "curated", label: "Homepage First" },
  { value: "manual", label: "Manual Order" },
];

const defaultUploadForm = {
  title: "",
  alt: "",
  caption: "",
  poem: "",
  collection: "City Life",
  featured: false,
  published: true,
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

function fileBaseName(filename) {
  if (typeof filename !== "string") {
    return "Untitled";
  }

  return filename.replace(/\.[a-z0-9]+$/i, "").trim() || "Untitled";
}

function mergeCollections(...values) {
  const flat = values
    .flat()
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  return [...new Set(flat)].sort((a, b) => a.localeCompare(b));
}

function toDraft(photo) {
  return {
    title: photo?.title || "",
    alt: photo?.alt || "",
    caption: photo?.caption || "",
    poem: photo?.poem || "",
    collection: photo?.collection || "City Life",
    featured: Boolean(photo?.featured),
    published: photo?.published !== false,
  };
}

function buildDraftMap(photos, previousDrafts = {}) {
  const nextDrafts = {};

  for (const photo of photos) {
    nextDrafts[photo.photoId] = previousDrafts[photo.photoId] || toDraft(photo);
  }

  return nextDrafts;
}

function toStringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isDraftDirty(photo, draft) {
  if (!photo || !draft) {
    return false;
  }

  return (
    toStringValue(photo.title) !== toStringValue(draft.title) ||
    toStringValue(photo.alt) !== toStringValue(draft.alt) ||
    toStringValue(photo.caption) !== toStringValue(draft.caption) ||
    toStringValue(photo.poem) !== toStringValue(draft.poem) ||
    toStringValue(photo.collection) !== toStringValue(draft.collection) ||
    Boolean(photo.featured) !== Boolean(draft.featured) ||
    (photo.published !== false) !== Boolean(draft.published)
  );
}

function resizeTextarea(element) {
  if (!element) {
    return;
  }

  element.style.height = "auto";
  element.style.height = `${Math.max(140, element.scrollHeight)}px`;
}

function areOrdersEqual(photoList, referenceIds = []) {
  if (!Array.isArray(photoList) || photoList.length !== referenceIds.length) {
    return false;
  }

  for (let index = 0; index < photoList.length; index += 1) {
    if (photoList[index]?.photoId !== referenceIds[index]) {
      return false;
    }
  }

  return true;
}

function reorderPhotoList(photoList, fromPhotoId, toPhotoId) {
  if (!Array.isArray(photoList) || !fromPhotoId || !toPhotoId || fromPhotoId === toPhotoId) {
    return photoList;
  }

  const fromIndex = photoList.findIndex((item) => item.photoId === fromPhotoId);
  const toIndex = photoList.findIndex((item) => item.photoId === toPhotoId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return photoList;
  }

  const next = [...photoList];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
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

function PoemToolbar({ onInsert }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onInsert("\n")}
        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
      >
        Line Break
      </button>
      <button
        type="button"
        onClick={() => onInsert("\n\n")}
        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
      >
        New Stanza
      </button>
      <button
        type="button"
        onClick={() => onInsert("*", "*")}
        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
      >
        Italic
      </button>
      <button
        type="button"
        onClick={() => onInsert("**", "**")}
        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
      >
        Emphasis
      </button>
    </div>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 5a1 1 0 0 1 1-1h11l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Z" />
      <path d="M8 4v6h8V4" />
      <path d="M8 20v-6h8v6" />
    </svg>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("upload");

  const [uploadForm, setUploadForm] = useState(defaultUploadForm);
  const [files, setFiles] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadResults, setUploadResults] = useState([]);

  const [photos, setPhotos] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [collections, setCollections] = useState(baseCollections);
  const [ready, setReady] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [csrfToken, setCsrfToken] = useState("");
  const [manageStatus, setManageStatus] = useState("idle");
  const [manageMessage, setManageMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("All");
  const [librarySort, setLibrarySort] = useState("newest");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [pageSize, setPageSize] = useState(48);
  const [page, setPage] = useState(1);
  const [totalPhotos, setTotalPhotos] = useState(0);

  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [activePhotoId, setActivePhotoId] = useState("");
  const [homepageActivePhotoId, setHomepageActivePhotoId] = useState("");
  const [bulkCollection, setBulkCollection] = useState("City Life");
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [savingPhotoId, setSavingPhotoId] = useState("");
  const [deletingPhotoId, setDeletingPhotoId] = useState("");
  const [showLibraryHelp, setShowLibraryHelp] = useState(false);
  const [homepagePool, setHomepagePool] = useState([]);
  const [homepagePhotoIds, setHomepagePhotoIds] = useState([]);
  const [homepageSearchInput, setHomepageSearchInput] = useState("");
  const [homepageLoading, setHomepageLoading] = useState(false);
  const [homepageStatus, setHomepageStatus] = useState("idle");
  const [homepageMessage, setHomepageMessage] = useState("");
  const [homepageDraggingPhotoId, setHomepageDraggingPhotoId] = useState("");
  const [homepageDragOverPhotoId, setHomepageDragOverPhotoId] = useState("");
  const [isSavingHomepage, setIsSavingHomepage] = useState(false);
  const [hasHomepageChanges, setHasHomepageChanges] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renameFromCollection, setRenameFromCollection] = useState("");
  const [renameToCollection, setRenameToCollection] = useState("");
  const [moveFromCollection, setMoveFromCollection] = useState("");
  const [moveToCollection, setMoveToCollection] = useState("City Life");
  const [isUpdatingCollections, setIsUpdatingCollections] = useState(false);
  const [draggingPhotoId, setDraggingPhotoId] = useState("");
  const [dragOverPhotoId, setDragOverPhotoId] = useState("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [switchPrompt, setSwitchPrompt] = useState({
    open: false,
    nextPhotoId: "",
  });
  const [workspaceSwitchPrompt, setWorkspaceSwitchPrompt] = useState({
    open: false,
    nextTab: "",
  });
  const [isSavingBeforeWorkspaceSwitch, setIsSavingBeforeWorkspaceSwitch] = useState(false);

  const [poemModal, setPoemModal] = useState({
    open: false,
    mode: "upload",
    photoId: "",
  });

  const uploadPoemRef = useRef(null);
  const editorPoemRef = useRef(null);
  const modalPoemRef = useRef(null);
  const editorPanelRef = useRef(null);
  const homepageSequenceRef = useRef(null);
  const baseOrderRef = useRef([]);
  const baseHomepageOrderRef = useRef([]);

  const isUploading = uploadStatus === "uploading";
  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const selectedCount = selectedPhotoIds.length;

  const collectionOptions = useMemo(
    () => mergeCollections(baseCollections, collections, photos.map((photo) => photo.collection)),
    [collections, photos],
  );

  const isUploadTab = activeTab === "upload";
  const isHomepageTab = activeTab === "homepage";
  const isDraftsTab = activeTab === "drafts";
  const isLibraryTab = activeTab === "library" || isDraftsTab;
  const canManualReorder = isLibraryTab && !isDraftsTab && librarySort === "manual";
  const effectivePublishedFilter = isDraftsTab ? "draft" : publishedFilter;
  const librarySortOptions = useMemo(
    () =>
      isDraftsTab
        ? LIBRARY_SORT_OPTIONS.filter(
            (option) => option.value !== "manual" && option.value !== "curated",
          )
        : LIBRARY_SORT_OPTIONS,
    [isDraftsTab],
  );

  const activePhoto = useMemo(
    () => photos.find((photo) => photo.photoId === activePhotoId) || null,
    [activePhotoId, photos],
  );

  const activeDraft = useMemo(() => {
    if (!activePhotoId) {
      return null;
    }

    return drafts[activePhotoId] || null;
  }, [activePhotoId, drafts]);

  const activeIsDirty = useMemo(() => {
    if (!activePhoto || !activeDraft) {
      return false;
    }

    return isDraftDirty(activePhoto, activeDraft);
  }, [activeDraft, activePhoto]);
  const homepagePhotoMap = useMemo(
    () => new Map(homepagePool.map((photo) => [photo.photoId, photo])),
    [homepagePool],
  );
  const homepageSearchTerm = homepageSearchInput.trim().toLowerCase();
  const homepageSelectedSet = useMemo(() => new Set(homepagePhotoIds), [homepagePhotoIds]);
  const homepageSelectedPhotos = useMemo(
    () =>
      homepagePhotoIds
        .map((photoId) => homepagePhotoMap.get(photoId))
        .filter(Boolean),
    [homepagePhotoIds, homepagePhotoMap],
  );
  const homepageAvailablePhotos = useMemo(
    () => homepagePool.filter((photo) => !homepageSelectedSet.has(photo.photoId)),
    [homepagePool, homepageSelectedSet],
  );
  const homepageActivePhoto = useMemo(() => {
    if (!homepageActivePhotoId) {
      const firstId = homepagePhotoIds[0];
      return firstId ? homepagePhotoMap.get(firstId) || null : null;
    }

    return homepagePhotoMap.get(homepageActivePhotoId) || null;
  }, [homepageActivePhotoId, homepagePhotoIds, homepagePhotoMap]);
  const homepageActiveDraft = useMemo(() => {
    if (!homepageActivePhoto) {
      return null;
    }

    return drafts[homepageActivePhoto.photoId] || toDraft(homepageActivePhoto);
  }, [drafts, homepageActivePhoto]);
  const homepageActiveIsDirty = useMemo(() => {
    if (!homepageActivePhoto || !homepageActiveDraft) {
      return false;
    }

    return isDraftDirty(homepageActivePhoto, homepageActiveDraft);
  }, [homepageActiveDraft, homepageActivePhoto]);

  const dirtyPhotoCount = useMemo(() => {
    const uniquePhotos = new Map();
    for (const photo of photos) {
      uniquePhotos.set(photo.photoId, photo);
    }
    for (const photo of homepagePool) {
      if (!uniquePhotos.has(photo.photoId)) {
        uniquePhotos.set(photo.photoId, photo);
      }
    }

    let count = 0;
    for (const photo of uniquePhotos.values()) {
      if (isDraftDirty(photo, drafts[photo.photoId])) {
        count += 1;
      }
    }
    return count;
  }, [drafts, photos, homepagePool]);

  const hasUnsavedChanges = dirtyPhotoCount > 0;
  const totalPages = Math.max(1, Math.ceil(totalPhotos / pageSize));
  const filteredHomepageSelectedPhotos = useMemo(() => {
    if (!homepageSearchTerm) {
      return homepageSelectedPhotos;
    }

    return homepageSelectedPhotos.filter((photo) => {
      const title = toStringValue(photo.title).toLowerCase();
      const caption = toStringValue(photo.caption).toLowerCase();
      const poem = toStringValue(photo.poem).toLowerCase();
      const collection = toStringValue(photo.collection).toLowerCase();
      return (
        title.includes(homepageSearchTerm) ||
        caption.includes(homepageSearchTerm) ||
        poem.includes(homepageSearchTerm) ||
        collection.includes(homepageSearchTerm)
      );
    });
  }, [homepageSearchTerm, homepageSelectedPhotos]);
  const filteredHomepageAvailablePhotos = useMemo(() => {
    const sorted = [...homepageAvailablePhotos].sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );

    if (!homepageSearchTerm) {
      return sorted;
    }

    return sorted.filter((photo) => {
      const title = toStringValue(photo.title).toLowerCase();
      const caption = toStringValue(photo.caption).toLowerCase();
      const poem = toStringValue(photo.poem).toLowerCase();
      const collection = toStringValue(photo.collection).toLowerCase();
      return (
        title.includes(homepageSearchTerm) ||
        caption.includes(homepageSearchTerm) ||
        poem.includes(homepageSearchTerm) ||
        collection.includes(homepageSearchTerm)
      );
    });
  }, [homepageAvailablePhotos, homepageSearchTerm]);

  const ensureCsrfToken = useCallback(async () => {
    if (csrfToken) {
      return csrfToken;
    }

    const result = await fetch("/api/csrf", { cache: "no-store" }).then(parseJsonResponse);
    const token = result?.csrfToken || "";
    if (!token) {
      throw new Error("Unable to initialize CSRF token.");
    }
    setCsrfToken(token);
    return token;
  }, [csrfToken]);

  const fetchWithCsrf = useCallback(
    async (url, options = {}) => {
      const token = await ensureCsrfToken();
      const headers = new Headers(options.headers || {});
      headers.set(CSRF_HEADER_NAME, token);

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [ensureCsrfToken],
  );

  const loadHeaderData = useCallback(async () => {
    try {
      const [uploadHealth, csrf] = await Promise.all([
        fetch("/api/upload", { cache: "no-store" }).then(parseJsonResponse),
        fetch("/api/csrf", { cache: "no-store" }).then(parseJsonResponse),
      ]);

      setReady(Boolean(uploadHealth.ready));
      setCsrfToken(csrf?.csrfToken || "");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to initialize admin state.");
    }
  }, []);

  const loadLibraryData = useCallback(async () => {
    if (!isLibraryTab) {
      return;
    }

    setLoadingPhotos(true);

    try {
      const params = new URLSearchParams({
        sort: librarySort,
        includeDrafts: "1",
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });
      if (collectionFilter !== "All") {
        params.set("collection", collectionFilter);
      }
      if (searchQuery) {
        params.set("q", searchQuery);
      }
      if (effectivePublishedFilter !== "all") {
        params.set("published", effectivePublishedFilter);
      }

      const photoList = await fetch(`/api/photos?${params.toString()}`, {
        cache: "no-store",
      }).then(parseJsonResponse);

      const nextPhotos = Array.isArray(photoList.photos) ? photoList.photos : [];
      const nextTotal = Number(photoList?.pagination?.total) || 0;
      const nextOrder = nextPhotos.map((photo) => photo.photoId);

      setPhotos(nextPhotos);
      setTotalPhotos(nextTotal);
      setCollections((current) => mergeCollections(current, photoList.collections || []));
      setDrafts((current) => buildDraftMap(nextPhotos, current));
      setBulkCollection((current) => current || "City Life");
      baseOrderRef.current = nextOrder;
      setHasOrderChanges(false);
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      setManageStatus("idle");
      setManageMessage("");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to load photo library.");
    } finally {
      setLoadingPhotos(false);
    }
  }, [collectionFilter, effectivePublishedFilter, isLibraryTab, librarySort, page, pageSize, searchQuery]);

  const loadHomepageData = useCallback(async () => {
    setHomepageLoading(true);

    try {
      const params = new URLSearchParams({
        includeDrafts: "1",
        published: "published",
        sort: "manual",
        limit: "300",
        offset: "0",
      });

      const result = await fetch(`/api/photos?${params.toString()}`, {
        cache: "no-store",
      }).then(parseJsonResponse);

      const nextPhotos = Array.isArray(result.photos) ? result.photos : [];
      const nextFeatured = nextPhotos
        .filter((photo) => photo.featured)
        .sort((a, b) => {
          const orderA = typeof a.featuredOrder === "number" ? a.featuredOrder : Number.MAX_SAFE_INTEGER;
          const orderB = typeof b.featuredOrder === "number" ? b.featuredOrder : Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return (a.order || 0) - (b.order || 0);
        })
        .map((photo) => photo.photoId)
        .slice(0, HOMEPAGE_MAX_PHOTOS);

      setHomepagePool(nextPhotos);
      setHomepagePhotoIds(nextFeatured);
      baseHomepageOrderRef.current = nextFeatured;
      setHasHomepageChanges(false);
      setHomepageDraggingPhotoId("");
      setHomepageDragOverPhotoId("");
      setHomepageStatus("idle");
      setHomepageMessage("");
      setCollections((current) => mergeCollections(current, result.collections || []));
    } catch (error) {
      setHomepageStatus("error");
      setHomepageMessage(error.message || "Unable to load homepage editor.");
    } finally {
      setHomepageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHeaderData();
  }, [loadHeaderData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    loadLibraryData();
  }, [loadLibraryData]);

  useEffect(() => {
    loadHomepageData();
  }, [loadHomepageData]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (isDraftsTab && (librarySort === "manual" || librarySort === "curated")) {
      setLibrarySort("newest");
    }
  }, [isDraftsTab, librarySort]);

  useEffect(() => {
    if (canManualReorder) {
      return;
    }

    setHasOrderChanges(false);
    setDraggingPhotoId("");
    setDragOverPhotoId("");
  }, [canManualReorder]);

  useEffect(() => {
    setSelectedPhotoIds((current) =>
      current.filter((photoId) => photos.some((photo) => photo.photoId === photoId)),
    );
  }, [photos]);

  useEffect(() => {
    if (!activePhotoId) {
      setActivePhotoId(photos[0]?.photoId || "");
      return;
    }

    if (!photos.some((photo) => photo.photoId === activePhotoId)) {
      setActivePhotoId(photos[0]?.photoId || "");
    }
  }, [activePhotoId, photos]);

  useEffect(() => {
    if (!homepageActivePhotoId) {
      setHomepageActivePhotoId(homepagePhotoIds[0] || "");
      return;
    }

    if (!homepagePhotoIds.includes(homepageActivePhotoId)) {
      setHomepageActivePhotoId(homepagePhotoIds[0] || "");
    }
  }, [homepageActivePhotoId, homepagePhotoIds]);

  useEffect(() => {
    if (!homepagePool.length) {
      return;
    }

    setDrafts((current) => buildDraftMap(homepagePool, current));
  }, [homepagePool]);

  useEffect(() => {
    if (!activePhotoId) {
      return;
    }

    const panel = editorPanelRef.current;
    if (panel) {
      panel.scrollTop = 0;
    }
  }, [activePhotoId]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleUploadFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setUploadForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (event) => {
    const incoming = Array.from(event.target.files || []);
    setFiles(incoming);
  };

  const updatePoemValue = useCallback((mode, photoId, value) => {
    if (mode === "upload") {
      setUploadForm((current) => ({ ...current, poem: value }));
      return;
    }

    if (!photoId) {
      return;
    }

    setDrafts((current) => ({
      ...current,
      [photoId]: {
        ...(current[photoId] || toDraft(photos.find((photo) => photo.photoId === photoId))),
        poem: value,
      },
    }));
  }, [photos]);

  const insertPoemFormatting = useCallback((before, after = before) => {
    const target = poemModal.open ? poemModal : { mode: activeTab === "upload" ? "upload" : "photo", photoId: activePhotoId };
    const targetRef = poemModal.open
      ? modalPoemRef
      : target.mode === "upload"
        ? uploadPoemRef
        : editorPoemRef;
    const element = targetRef.current;
    if (!element) {
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const selected = element.value.slice(start, end);
    const replacement = `${before}${selected}${after}`;
    const nextValue = `${element.value.slice(0, start)}${replacement}${element.value.slice(end)}`;

    updatePoemValue(target.mode, target.photoId, nextValue);

    requestAnimationFrame(() => {
      const currentElement = targetRef.current;
      if (!currentElement) {
        return;
      }

      currentElement.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      currentElement.setSelectionRange(cursorStart, cursorEnd);
      resizeTextarea(currentElement);
    });
  }, [activePhotoId, activeTab, poemModal, updatePoemValue]);

  const modalPoemValue =
    poemModal.mode === "upload"
      ? uploadForm.poem
      : drafts[poemModal.photoId]?.poem || "";

  const openPoemEditor = useCallback((mode, photoId = "") => {
    setPoemModal({ open: true, mode, photoId });
  }, []);

  const closePoemEditor = useCallback(() => {
    setPoemModal({ open: false, mode: "upload", photoId: "" });
  }, []);

  useEffect(() => {
    if (!poemModal.open) {
      return;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closePoemEditor();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closePoemEditor, poemModal.open]);

  useEffect(() => {
    if (!poemModal.open) {
      return;
    }

    const nextFrame = requestAnimationFrame(() => {
      const element = modalPoemRef.current;
      if (!element) {
        return;
      }
      resizeTextarea(element);
      element.focus();
    });

    return () => cancelAnimationFrame(nextFrame);
  }, [modalPoemValue, poemModal.open]);

  const handleUploadSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (files.length === 0) {
      setUploadStatus("error");
      setUploadMessage("Select one or more photos to upload.");
      return;
    }

    setUploadStatus("uploading");
    setUploadMessage(`Uploading ${files.length} photo(s)...`);
    setUploadResults([]);

    try {
      const signaturePayload = await fetchWithCsrf("/api/upload/signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          folder: `freenyc/${slugify(uploadForm.collection || "city-life")}`,
        }),
      }).then(parseJsonResponse);

      const nextResults = [];
      let successCount = 0;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const defaultTitle = fileBaseName(file.name);

        if (!file.type.startsWith("image/")) {
          nextResults.push({
            fileName: file.name,
            status: "error",
            message: "Skipped: not an image file.",
          });
          continue;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
          nextResults.push({
            fileName: file.name,
            status: "error",
            message: "Skipped: file is larger than 12MB.",
          });
          continue;
        }

        try {
          const cloudinaryForm = new FormData();
          cloudinaryForm.set("file", file);
          cloudinaryForm.set("api_key", signaturePayload.apiKey);
          cloudinaryForm.set("timestamp", String(signaturePayload.timestamp));
          cloudinaryForm.set("signature", signaturePayload.signature);
          if (signaturePayload.folder) {
            cloudinaryForm.set("folder", signaturePayload.folder);
          }
          if (signaturePayload.maxFileSize) {
            cloudinaryForm.set("max_file_size", String(signaturePayload.maxFileSize));
          }
          if (signaturePayload.allowedFormats) {
            cloudinaryForm.set("allowed_formats", signaturePayload.allowedFormats);
          }

          const cloudinaryResult = await fetch(signaturePayload.uploadUrl, {
            method: "POST",
            body: cloudinaryForm,
          }).then(parseJsonResponse);

          const titleSeed = toStringValue(uploadForm.title);
          const title =
            files.length === 1
              ? titleSeed || defaultTitle
              : titleSeed
                ? `${titleSeed} ${index + 1}`
                : defaultTitle;
          const altSeed = toStringValue(uploadForm.alt);
          const alt = altSeed || title;

          await fetchWithCsrf("/api/upload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              secureUrl: cloudinaryResult.secure_url,
              publicId: cloudinaryResult.public_id,
              title,
              alt,
              caption: uploadForm.caption,
              poem: uploadForm.poem,
              collection: uploadForm.collection,
              featured: uploadForm.featured,
              published: uploadForm.published,
            }),
          }).then(parseJsonResponse);

          successCount += 1;
          nextResults.push({
            fileName: file.name,
            status: "success",
            message: "Uploaded and saved.",
          });
        } catch (error) {
          nextResults.push({
            fileName: file.name,
            status: "error",
            message: error.message || "Upload failed.",
          });
        }
      }

      const errorCount = nextResults.length - successCount;
      setUploadResults(nextResults);
      setUploadStatus(errorCount === 0 ? "success" : "error");
      setUploadMessage(
        `Finished: ${successCount} successful, ${errorCount} failed/skipped.`,
      );

      if (successCount > 0) {
        setFiles([]);
        setFileInputKey((current) => current + 1);
        await loadLibraryData();
        await loadHomepageData();
      }
    } catch (error) {
      setUploadStatus("error");
      setUploadMessage(error.message || "Unable to start upload.");
    }
  }, [fetchWithCsrf, files, loadHomepageData, loadLibraryData, uploadForm]);

  const handleDraftChange = (photoId, field, value) => {
    setDrafts((current) => ({
      ...current,
      [photoId]: {
        ...(current[photoId] || toDraft(photos.find((photo) => photo.photoId === photoId))),
        [field]: value,
      },
    }));
  };

  const savePhoto = useCallback(async (photoId) => {
    const draft = drafts[photoId];
    if (!draft) {
      return false;
    }

    setSavingPhotoId(photoId);
    setManageStatus("idle");
    setManageMessage("");

    try {
      const result = await fetchWithCsrf(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          alt: draft.alt,
          caption: draft.caption,
          poem: draft.poem,
          collection: draft.collection,
          featured: Boolean(draft.featured),
          published: Boolean(draft.published),
        }),
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
      await loadHomepageData();
      return true;
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to save photo.");
      return false;
    } finally {
      setSavingPhotoId("");
    }
  }, [drafts, fetchWithCsrf, loadHomepageData]);

  const deletePhoto = useCallback(async (photo) => {
    const confirmed = window.confirm(`Delete "${photo.title || "Untitled"}"?`);
    if (!confirmed) {
      return;
    }

    setDeletingPhotoId(photo.photoId);
    setManageStatus("idle");
    setManageMessage("");

    try {
      await fetchWithCsrf(`/api/photos/${photo.photoId}`, {
        method: "DELETE",
      }).then(parseJsonResponse);

      setPhotos((current) => current.filter((item) => item.photoId !== photo.photoId));
      setDrafts((current) => {
        const next = { ...current };
        delete next[photo.photoId];
        return next;
      });
      setSelectedPhotoIds((current) => current.filter((id) => id !== photo.photoId));
      setManageStatus("success");
      setManageMessage("Photo deleted.");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to delete photo.");
    } finally {
      setDeletingPhotoId("");
    }
  }, [fetchWithCsrf]);

  const movePhotoInGrid = useCallback((fromPhotoId, toPhotoId) => {
    setPhotos((current) => {
      const next = reorderPhotoList(current, fromPhotoId, toPhotoId);
      if (next === current) {
        return current;
      }

      setHasOrderChanges(!areOrdersEqual(next, baseOrderRef.current));
      return next;
    });
  }, []);

  const savePhotoOrder = useCallback(async () => {
    if (!hasOrderChanges || photos.length < 2) {
      return true;
    }

    setIsSavingOrder(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          photoIds: photos.map((item) => item.photoId),
        }),
      }).then(parseJsonResponse);

      baseOrderRef.current = photos.map((item) => item.photoId);
      setHasOrderChanges(false);
      setManageStatus("success");
      setManageMessage("Photo order saved.");
      await loadLibraryData();
      return true;
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to save order.");
      return false;
    } finally {
      setIsSavingOrder(false);
    }
  }, [fetchWithCsrf, hasOrderChanges, loadLibraryData, photos]);

  const handleCardDragStart = (event, photoId) => {
    if (!canManualReorder) {
      return;
    }
    setDraggingPhotoId(photoId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", photoId);
  };

  const handleCardDragOver = (event, photoId) => {
    if (!canManualReorder) {
      return;
    }
    if (!draggingPhotoId || draggingPhotoId === photoId) {
      return;
    }

    event.preventDefault();
    autoScrollPageWhileDragging(event);
    event.dataTransfer.dropEffect = "move";
    setDragOverPhotoId(photoId);
  };

  const handleCardDrop = (event, photoId) => {
    if (!canManualReorder) {
      return;
    }
    event.preventDefault();
    const droppedPhotoId = event.dataTransfer.getData("text/plain") || draggingPhotoId;

    if (!droppedPhotoId || droppedPhotoId === photoId) {
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      return;
    }

    movePhotoInGrid(droppedPhotoId, photoId);
    setDraggingPhotoId("");
    setDragOverPhotoId("");
  };

  const handleCardDragEnd = () => {
    if (!canManualReorder) {
      return;
    }
    setDraggingPhotoId("");
    setDragOverPhotoId("");
  };

  const requestPhotoSelection = (nextPhotoId) => {
    if (!nextPhotoId || nextPhotoId === activePhotoId) {
      return;
    }

    if (activePhoto && activeDraft && isDraftDirty(activePhoto, activeDraft)) {
      setSwitchPrompt({
        open: true,
        nextPhotoId,
      });
      return;
    }

    setActivePhotoId(nextPhotoId);
  };

  const cancelPhotoSwitch = () => {
    setSwitchPrompt({ open: false, nextPhotoId: "" });
  };

  const discardAndSwitch = () => {
    if (activePhoto) {
      setDrafts((current) => ({
        ...current,
        [activePhoto.photoId]: toDraft(activePhoto),
      }));
    }
    const nextPhotoId = switchPrompt.nextPhotoId;
    setSwitchPrompt({ open: false, nextPhotoId: "" });
    if (nextPhotoId) {
      setActivePhotoId(nextPhotoId);
    }
  };

  const saveAndSwitch = async () => {
    if (!activePhoto) {
      cancelPhotoSwitch();
      return;
    }

    const nextPhotoId = switchPrompt.nextPhotoId;
    const saved = await savePhoto(activePhoto.photoId);
    if (!saved) {
      return;
    }

    setSwitchPrompt({ open: false, nextPhotoId: "" });
    if (nextPhotoId) {
      setActivePhotoId(nextPhotoId);
    }
  };

  const hasAnyPendingChanges = hasUnsavedChanges || hasOrderChanges || hasHomepageChanges;

  const requestWorkspaceTabChange = (nextTab) => {
    if (!nextTab || nextTab === activeTab) {
      return;
    }

    if (hasAnyPendingChanges) {
      setWorkspaceSwitchPrompt({
        open: true,
        nextTab,
      });
      return;
    }

    setPage(1);
    setActiveTab(nextTab);
  };

  const cancelWorkspaceSwitch = () => {
    setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
  };

  const discardPendingChangesAndSwitchTab = () => {
    const nextTab = workspaceSwitchPrompt.nextTab;

    if (photos.length > 0 || homepagePool.length > 0) {
      setDrafts((current) => {
        const nextDrafts = { ...current };
        const uniquePhotos = new Map();
        for (const photo of photos) {
          uniquePhotos.set(photo.photoId, photo);
        }
        for (const photo of homepagePool) {
          if (!uniquePhotos.has(photo.photoId)) {
            uniquePhotos.set(photo.photoId, photo);
          }
        }

        for (const photo of uniquePhotos.values()) {
          nextDrafts[photo.photoId] = toDraft(photo);
        }
        return nextDrafts;
      });
    }

    if (hasOrderChanges) {
      setPhotos((current) => {
        const map = new Map(current.map((item) => [item.photoId, item]));
        const restored = baseOrderRef.current
          .map((photoId) => map.get(photoId))
          .filter(Boolean);
        return restored.length === current.length ? restored : current;
      });
      setHasOrderChanges(false);
      setDraggingPhotoId("");
      setDragOverPhotoId("");
    }

    if (hasHomepageChanges) {
      setHomepagePhotoIds(baseHomepageOrderRef.current);
      setHasHomepageChanges(false);
      setHomepageDraggingPhotoId("");
      setHomepageDragOverPhotoId("");
    }

    setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
    if (nextTab) {
      setPage(1);
      setActiveTab(nextTab);
    }
  };

  const savePendingChangesAndSwitchTab = async () => {
    const nextTab = workspaceSwitchPrompt.nextTab;
    if (!nextTab) {
      setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
      return;
    }

    setIsSavingBeforeWorkspaceSwitch(true);

    try {
      if (hasUnsavedChanges) {
        const uniquePhotos = new Map();
        for (const photo of photos) {
          uniquePhotos.set(photo.photoId, photo);
        }
        for (const photo of homepagePool) {
          if (!uniquePhotos.has(photo.photoId)) {
            uniquePhotos.set(photo.photoId, photo);
          }
        }

        const dirtyPhotoIds = Array.from(uniquePhotos.values())
          .filter((photo) => isDraftDirty(photo, drafts[photo.photoId]))
          .map((photo) => photo.photoId);

        for (const photoId of dirtyPhotoIds) {
          const saved = await savePhoto(photoId);
          if (!saved) {
            return;
          }
        }
      }

      if (hasOrderChanges) {
        const orderSaved = await savePhotoOrder();
        if (!orderSaved) {
          return;
        }
      }

      if (hasHomepageChanges) {
        const homepageSaved = await saveHomepageSelection();
        if (!homepageSaved) {
          return;
        }
      }

      setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
      setPage(1);
      setActiveTab(nextTab);
    } finally {
      setIsSavingBeforeWorkspaceSwitch(false);
    }
  };

  const normalizeCollectionName = (value) => toStringValue(value).slice(0, 80);

  const autoScrollPageWhileDragging = (event) => {
    const threshold = 120;
    const speed = 18;
    if (event.clientY < threshold) {
      window.scrollBy(0, -speed);
    } else if (event.clientY > window.innerHeight - threshold) {
      window.scrollBy(0, speed);
    }
  };

  const autoScrollHomepageSequence = (event) => {
    const container = homepageSequenceRef.current;
    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const threshold = 72;
    const speed = 18;
    if (event.clientY < bounds.top + threshold) {
      container.scrollTop -= speed;
    } else if (event.clientY > bounds.bottom - threshold) {
      container.scrollTop += speed;
    }
  };

  const addPhotoToHomepage = (photoId) => {
    if (!photoId || homepageSelectedSet.has(photoId)) {
      return;
    }

    const sourcePhoto =
      homepagePhotoMap.get(photoId) || photos.find((photo) => photo.photoId === photoId) || null;
    if (sourcePhoto?.published === false) {
      setHomepageStatus("error");
      setHomepageMessage("Only published photos can be added to homepage.");
      return;
    }

    if (homepagePhotoIds.length >= HOMEPAGE_MAX_PHOTOS) {
      setHomepageStatus("error");
      setHomepageMessage(`Homepage supports up to ${HOMEPAGE_MAX_PHOTOS} photos.`);
      return;
    }

    const next = [...homepagePhotoIds, photoId];
    applyHomepageOrder(next);
    if (!homepageActivePhotoId) {
      setHomepageActivePhotoId(photoId);
    }
  };

  const removePhotoFromHomepage = (photoId) => {
    const next = homepagePhotoIds.filter((id) => id !== photoId);
    applyHomepageOrder(next);
  };

  const applyHomepageOrder = (nextPhotoIds) => {
    setHomepagePhotoIds(nextPhotoIds);
    setHasHomepageChanges(
      !areOrdersEqual(nextPhotoIds.map((id) => ({ photoId: id })), baseHomepageOrderRef.current),
    );
    setHomepageStatus("idle");
    setHomepageMessage("");
  };

  const moveHomepagePhoto = (fromPhotoId, toPhotoId) => {
    const next = reorderPhotoList(
      homepagePhotoIds.map((photoId) => ({ photoId })),
      fromPhotoId,
      toPhotoId,
    ).map((item) => item.photoId);
    applyHomepageOrder(next);
  };

  const insertHomepagePhotoAt = (photoId, targetPhotoId) => {
    if (!photoId) {
      return;
    }

    const isAlreadySelected = homepageSelectedSet.has(photoId);
    if (!isAlreadySelected && homepagePhotoIds.length >= HOMEPAGE_MAX_PHOTOS) {
      setHomepageStatus("error");
      setHomepageMessage(`Homepage supports up to ${HOMEPAGE_MAX_PHOTOS} photos.`);
      return;
    }

    const withoutPhoto = homepagePhotoIds.filter((id) => id !== photoId);
    const targetIndex = withoutPhoto.findIndex((id) => id === targetPhotoId);
    if (targetIndex < 0) {
      const appended = [...withoutPhoto, photoId];
      applyHomepageOrder(appended);
      return;
    }

    const next = [...withoutPhoto];
    next.splice(targetIndex, 0, photoId);
    applyHomepageOrder(next);
  };

  const parseHomepageDragPayload = (event) => {
    const raw = event.dataTransfer.getData("text/plain") || "";
    if (!raw) {
      return { source: "", photoId: "" };
    }

    if (raw.startsWith("pool:")) {
      return { source: "pool", photoId: raw.slice(5) };
    }

    if (raw.startsWith("sequence:")) {
      return { source: "sequence", photoId: raw.slice(9) };
    }

    return { source: "sequence", photoId: raw };
  };

  const saveHomepageSelection = async () => {
    setIsSavingHomepage(true);
    setHomepageStatus("idle");
    setHomepageMessage("");

    try {
      const result = await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "setFeaturedOrder",
          photoIds: homepagePhotoIds,
        }),
      }).then(parseJsonResponse);

      const next = Array.isArray(result.photoIds) ? result.photoIds : homepagePhotoIds;
      setHomepagePhotoIds(next);
      baseHomepageOrderRef.current = next;
      setHasHomepageChanges(false);
      setHomepageStatus("success");
      setHomepageMessage("Homepage curation saved.");

      if (isLibraryTab) {
        await loadLibraryData();
      }
      return true;
    } catch (error) {
      setHomepageStatus("error");
      setHomepageMessage(error.message || "Unable to save homepage selection.");
      return false;
    } finally {
      setIsSavingHomepage(false);
    }
  };

  const handleHomepageDragStart = (event, photoId) => {
    setHomepageDraggingPhotoId(photoId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `sequence:${photoId}`);
  };

  const handleHomepagePoolDragStart = (event, photoId) => {
    setHomepageDraggingPhotoId(photoId);
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", `pool:${photoId}`);
  };

  const handleHomepageDragOver = (event, photoId) => {
    const payload = parseHomepageDragPayload(event);
    if (!payload.photoId || payload.photoId === photoId) {
      return;
    }

    event.preventDefault();
    autoScrollHomepageSequence(event);
    setHomepageDragOverPhotoId(photoId);
    event.dataTransfer.dropEffect = "move";
  };

  const handleHomepageDrop = (event, photoId) => {
    event.preventDefault();
    const payload = parseHomepageDragPayload(event);
    if (!payload.photoId || payload.photoId === photoId) {
      setHomepageDraggingPhotoId("");
      setHomepageDragOverPhotoId("");
      return;
    }

    if (payload.source === "pool") {
      insertHomepagePhotoAt(payload.photoId, photoId);
    } else {
      moveHomepagePhoto(payload.photoId, photoId);
    }
    setHomepageDraggingPhotoId("");
    setHomepageDragOverPhotoId("");
  };

  const handleHomepageListDragOver = (event) => {
    const payload = parseHomepageDragPayload(event);
    if (!payload.photoId) {
      return;
    }

    event.preventDefault();
    autoScrollHomepageSequence(event);
    event.dataTransfer.dropEffect = payload.source === "pool" ? "copy" : "move";
  };

  const handleHomepageListDrop = (event) => {
    event.preventDefault();
    const payload = parseHomepageDragPayload(event);
    if (!payload.photoId) {
      setHomepageDraggingPhotoId("");
      setHomepageDragOverPhotoId("");
      return;
    }

    if (payload.source === "pool") {
      addPhotoToHomepage(payload.photoId);
    } else {
      const without = homepagePhotoIds.filter((id) => id !== payload.photoId);
      applyHomepageOrder([...without, payload.photoId]);
    }

    setHomepageDraggingPhotoId("");
    setHomepageDragOverPhotoId("");
  };

  const handleHomepageDragEnd = () => {
    setHomepageDraggingPhotoId("");
    setHomepageDragOverPhotoId("");
  };

  const addCollectionOption = () => {
    const normalized = normalizeCollectionName(newCollectionName);
    if (!normalized) {
      setManageStatus("error");
      setManageMessage("Enter a collection name.");
      return;
    }

    setCollections((current) => mergeCollections(current, [normalized]));
    setBulkCollection(normalized);
    setNewCollectionName("");
    setManageStatus("success");
    setManageMessage("Collection added. Assign it to photos to persist.");
  };

  const runRenameCollection = async () => {
    const from = normalizeCollectionName(renameFromCollection);
    const to = normalizeCollectionName(renameToCollection);
    if (!from || !to) {
      setManageStatus("error");
      setManageMessage("Select a collection and enter a new name.");
      return;
    }

    if (from === to) {
      setManageStatus("error");
      setManageMessage("New collection name must be different.");
      return;
    }

    setIsUpdatingCollections(true);
    setManageStatus("idle");
    setManageMessage("");
    try {
      await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "renameCollection",
          fromCollection: from,
          toCollection: to,
        }),
      }).then(parseJsonResponse);

      setManageStatus("success");
      setManageMessage(`Collection renamed from "${from}" to "${to}".`);
      setRenameFromCollection("");
      setRenameToCollection("");
      await loadLibraryData();
      if (isHomepageTab) {
        await loadHomepageData();
      }
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to rename collection.");
    } finally {
      setIsUpdatingCollections(false);
    }
  };

  const runMoveCollection = async () => {
    const from = normalizeCollectionName(moveFromCollection);
    const to = normalizeCollectionName(moveToCollection);
    if (!from || !to) {
      setManageStatus("error");
      setManageMessage("Select source and destination collections.");
      return;
    }
    if (from === to) {
      setManageStatus("error");
      setManageMessage("Choose a different destination collection.");
      return;
    }

    setIsUpdatingCollections(true);
    setManageStatus("idle");
    setManageMessage("");
    try {
      await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "moveCollection",
          fromCollection: from,
          toCollection: to,
        }),
      }).then(parseJsonResponse);

      setManageStatus("success");
      setManageMessage(`Moved "${from}" photos to "${to}".`);
      setMoveFromCollection("");
      await loadLibraryData();
      if (isHomepageTab) {
        await loadHomepageData();
      }
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to move collection.");
    } finally {
      setIsUpdatingCollections(false);
    }
  };

  const toggleSelectPhoto = (photoId) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedCount === photos.length) {
      setSelectedPhotoIds([]);
      return;
    }

    setSelectedPhotoIds(photos.map((photo) => photo.photoId));
  };

  const runBulkPatch = async (updates, successMessage) => {
    if (selectedCount === 0) {
      setManageStatus("error");
      setManageMessage("Select at least one photo.");
      return;
    }

    setIsBulkRunning(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      for (const photoId of selectedPhotoIds) {
        await fetchWithCsrf(`/api/photos/${photoId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(updates),
        }).then(parseJsonResponse);
      }

      await loadLibraryData();
      setSelectedPhotoIds([]);
      setManageStatus("success");
      setManageMessage(successMessage);
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Bulk update failed.");
    } finally {
      setIsBulkRunning(false);
    }
  };

  const runBulkDelete = async () => {
    if (selectedCount === 0) {
      setManageStatus("error");
      setManageMessage("Select at least one photo.");
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedCount} selected photo(s)?`);
    if (!confirmed) {
      return;
    }

    setIsBulkRunning(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      for (const photoId of selectedPhotoIds) {
        await fetchWithCsrf(`/api/photos/${photoId}`, {
          method: "DELETE",
        }).then(parseJsonResponse);
      }

      await loadLibraryData();
      setSelectedPhotoIds([]);
      setManageStatus("success");
      setManageMessage("Selected photos deleted.");
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Bulk delete failed.");
    } finally {
      setIsBulkRunning(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-8 sm:py-10 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-muted uppercase">Admin Workspace</p>
          <h1 className="display-font mt-2 text-4xl leading-none sm:text-5xl">Photo Control Room</h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/75">
            Curate homepage highlights, manage library metadata, and keep drafts private until ready.
          </p>
        </div>

        <div className="text-left text-xs tracking-[0.14em] text-muted uppercase sm:text-right">
          <p>Cloudinary: {ready ? "Connected" : "Not Configured"}</p>
          <p className="mt-1">Loaded: {photos.length} of {totalPhotos}</p>
          <p className="mt-1">Unsaved edits: {dirtyPhotoCount}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("upload")}
          className={`border px-4 py-2 text-[11px] tracking-[0.14em] uppercase transition-colors ${
            isUploadTab
              ? "border-foreground bg-foreground text-background shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              : "border-line hover:border-foreground"
          }`}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("homepage")}
          className={`border px-4 py-2 text-[11px] tracking-[0.14em] uppercase transition-colors ${
            isHomepageTab
              ? "border-foreground bg-foreground text-background shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              : "border-line hover:border-foreground"
          }`}
        >
          Homepage
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("library")}
          className={`border px-4 py-2 text-[11px] tracking-[0.14em] uppercase transition-colors ${
            activeTab === "library"
              ? "border-foreground bg-foreground text-background shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              : "border-line hover:border-foreground"
          }`}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("drafts")}
          className={`border px-4 py-2 text-[11px] tracking-[0.14em] uppercase transition-colors ${
            isDraftsTab
              ? "border-foreground bg-foreground text-background shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
              : "border-line hover:border-foreground"
          }`}
        >
          Drafts
        </button>
      </div>

      {isUploadTab ? (
        <section className="mt-6 rounded-2xl border border-foreground/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.93)_0%,rgba(252,250,247,0.9)_100%)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:p-6">
          <h2 className="text-sm tracking-[0.14em] uppercase">Multi-Photo Upload</h2>
          <p className="mt-2 text-sm text-foreground/75">
            Upload many photos in one run. Metadata below is applied as a template.
          </p>

          <form onSubmit={handleUploadSubmit} className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="text-xs tracking-[0.14em] uppercase lg:col-span-2">
              Photo Files
              <input
                key={fileInputKey}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="mt-2 block w-full border border-foreground/30 bg-white px-4 py-3 text-sm normal-case outline-none file:mr-4 file:border file:border-foreground/30 file:bg-foreground file:px-3 file:py-1 file:text-[10px] file:tracking-[0.1em] file:text-background file:uppercase"
                disabled={isUploading}
              />
            </label>

            <p className="text-xs text-muted lg:col-span-2">
              {files.length} file(s) selected. Max per file: 12MB.
            </p>

            <label className="text-xs tracking-[0.14em] uppercase">
              Title Template
              <input
                name="title"
                value={uploadForm.title}
                onChange={handleUploadFieldChange}
                type="text"
                placeholder="Optional"
                className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                disabled={isUploading}
              />
            </label>

            <label className="text-xs tracking-[0.14em] uppercase">
              Alt Text Template
              <input
                name="alt"
                value={uploadForm.alt}
                onChange={handleUploadFieldChange}
                type="text"
                placeholder="Describe image for screen readers"
                className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                disabled={isUploading}
              />
            </label>

            <label className="text-xs tracking-[0.14em] uppercase">
              Collection
              <select
                name="collection"
                value={uploadForm.collection}
                onChange={handleUploadFieldChange}
                className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                disabled={isUploading}
              >
                {collectionOptions.map((collection) => (
                  <option key={collection} value={collection}>
                    {collection}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-xs tracking-[0.12em] uppercase">
                <input
                  type="checkbox"
                  name="featured"
                  checked={Boolean(uploadForm.featured)}
                  onChange={handleUploadFieldChange}
                  className="h-4 w-4 accent-foreground"
                  disabled={isUploading}
                />
                Feature On Homepage
              </label>
              <label className="flex items-center gap-2 text-xs tracking-[0.12em] uppercase">
                <input
                  type="checkbox"
                  name="published"
                  checked={Boolean(uploadForm.published)}
                  onChange={handleUploadFieldChange}
                  className="h-4 w-4 accent-foreground"
                  disabled={isUploading}
                />
                Published On Site
              </label>
              <p className="text-xs leading-5 text-muted">
                Published photos appear on public pages. Draft photos stay private in admin.
                Use the Homepage tab to choose homepage photos and main hero order.
              </p>
            </div>

            <label className="text-xs tracking-[0.14em] uppercase lg:col-span-2">
              Caption
              <textarea
                name="caption"
                value={uploadForm.caption}
                onChange={handleUploadFieldChange}
                rows={4}
                className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                disabled={isUploading}
              />
            </label>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs tracking-[0.14em] uppercase">Poem</p>
                <button
                  type="button"
                  onClick={() => openPoemEditor("upload")}
                  className="border border-line px-3 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                >
                  Expand Editor
                </button>
              </div>
              <PoemToolbar onInsert={insertPoemFormatting} />
              <textarea
                ref={uploadPoemRef}
                name="poem"
                value={uploadForm.poem}
                onChange={(event) => {
                  handleUploadFieldChange(event);
                  resizeTextarea(event.target);
                }}
                rows={6}
                className="mt-2 min-h-[160px] w-full border border-line px-3 py-2 text-sm leading-6 whitespace-pre-wrap normal-case outline-none focus:border-foreground"
                disabled={isUploading}
              />
            </div>

            <button
              type="submit"
              className="w-full border border-foreground bg-foreground px-6 py-3 text-[11px] tracking-[0.18em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-max"
              disabled={isUploading || !ready || files.length === 0}
            >
              {isUploading ? "Uploading..." : `Upload ${files.length || ""} Photo(s)`}
            </button>
          </form>

          {uploadMessage ? (
            <p className={`mt-4 text-sm ${uploadStatus === "error" ? "text-red-700" : "text-muted"}`}>
              {uploadMessage}
            </p>
          ) : null}

          {uploadResults.length > 0 ? (
            <div className="mt-4 max-h-56 overflow-y-auto border border-line">
              {uploadResults.map((item) => (
                <div
                  key={`${item.fileName}-${item.status}-${item.message}`}
                  className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-xs last:border-b-0"
                >
                  <p className="truncate">{item.fileName}</p>
                  <p className={item.status === "success" ? "text-emerald-700" : "text-red-700"}>
                    {item.message}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mt-6 space-y-5">
          {isHomepageTab ? (
            <>
              <div className="rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,245,240,0.9)_100%)] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.08)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm tracking-[0.14em] uppercase">Homepage Editor</h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted">
                      Curate the first page visitors see. Choose up to {HOMEPAGE_MAX_PHOTOS} published photos and set the sequence.
                      The first photo becomes the Main Photo.
                    </p>
                  </div>
                  <div className="text-right text-xs tracking-[0.12em] text-muted uppercase">
                    <p>{homepagePhotoIds.length} / {HOMEPAGE_MAX_PHOTOS} selected</p>
                    <p className="mt-1">{hasHomepageChanges ? "Unsaved homepage changes" : "Homepage saved"}</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full bg-foreground/80 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, (homepagePhotoIds.length / HOMEPAGE_MAX_PHOTOS) * 100)}%` }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveHomepageSelection}
                    disabled={isSavingHomepage || !hasHomepageChanges}
                    className="border border-foreground bg-foreground px-4 py-2 text-[10px] tracking-[0.14em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-45"
                  >
                    {isSavingHomepage ? "Saving..." : "Save Homepage"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHomepagePhotoIds(baseHomepageOrderRef.current);
                      setHasHomepageChanges(false);
                      setHomepageDraggingPhotoId("");
                      setHomepageDragOverPhotoId("");
                    }}
                    disabled={isSavingHomepage || !hasHomepageChanges}
                    className="border border-line px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground disabled:opacity-45"
                  >
                    Reset
                  </button>
                </div>

                {homepageMessage ? (
                  <p className={`mt-3 text-sm ${homepageStatus === "error" ? "text-red-700" : "text-muted"}`}>
                    {homepageMessage}
                  </p>
                ) : null}
              </div>

              <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.25fr)]">
                <section className="h-fit rounded-2xl border border-line bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
                  <h3 className="text-[11px] tracking-[0.14em] uppercase">Homepage Sequence</h3>
                  <p className="mt-2 text-sm text-muted">
                    Drag to reorder. Click a row to edit that homepage photo.
                  </p>

                  <input
                    value={homepageSearchInput}
                    onChange={(event) => setHomepageSearchInput(event.target.value)}
                    placeholder="Search title, caption, poem, category"
                    className="mt-3 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                  />

                  <div
                    ref={homepageSequenceRef}
                    onDragOver={handleHomepageListDragOver}
                    onDrop={handleHomepageListDrop}
                    className="mt-3 max-h-[62vh] space-y-2 overflow-y-auto pr-1"
                  >
                    {homepageLoading ? (
                      <p className="text-sm text-muted">Loading homepage photos...</p>
                    ) : filteredHomepageSelectedPhotos.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line px-3 py-5 text-sm text-muted">
                        {homepageSearchTerm ? "No matching homepage photos for this search." : "No homepage photos selected yet."}
                      </p>
                    ) : (
                      filteredHomepageSelectedPhotos.map((photo) => {
                        const draft = drafts[photo.photoId] || toDraft(photo);
                        const isDirty = isDraftDirty(photo, draft);
                        const isDragging = homepageDraggingPhotoId === photo.photoId;
                        const isDropTarget = homepageDragOverPhotoId === photo.photoId;
                        const isActive = homepageActivePhoto?.photoId === photo.photoId;
                        const slotLabel = homepagePhotoIds.findIndex((photoId) => photoId === photo.photoId) + 1;

                        return (
                          <article
                            key={photo.photoId}
                            draggable
                            onDragStart={(event) => handleHomepageDragStart(event, photo.photoId)}
                            onDragOver={(event) => handleHomepageDragOver(event, photo.photoId)}
                            onDrop={(event) => handleHomepageDrop(event, photo.photoId)}
                            onDragEnd={handleHomepageDragEnd}
                            onClick={() => setHomepageActivePhotoId(photo.photoId)}
                            className={`cursor-pointer rounded-xl border bg-white p-2 transition-all ${
                              isActive
                                ? "border-foreground shadow-[0_10px_24px_rgba(0,0,0,0.09)]"
                                : isDropTarget
                                  ? "border-foreground/70 ring-1 ring-foreground/25"
                                  : "border-line hover:border-foreground/45"
                            } ${isDragging ? "scale-[0.995] opacity-60" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs tracking-[0.08em] font-semibold ${
                                  slotLabel === 1
                                    ? "border-amber-500/70 bg-amber-50 text-amber-800"
                                    : "border-foreground/25 bg-zinc-50 text-foreground/85"
                                }`}
                                aria-label={`Homepage position ${slotLabel}`}
                                title={`Homepage position ${slotLabel}`}
                              >
                                #{slotLabel}
                              </div>

                              <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded border border-line bg-zinc-200">
                                <Image
                                  src={photo.thumbnailUrl || photo.imageUrl}
                                  alt={photo.alt || photo.title || "Homepage photo"}
                                  fill
                                  sizes="80px"
                                  className="object-cover"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{photo.title || "Untitled"}</p>
                                <p className="mt-1 truncate text-[10px] tracking-[0.12em] text-muted uppercase">
                                  {photo.collection}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                {slotLabel === 1 ? (
                                  <span className="rounded-full border border-amber-500/70 bg-amber-50 px-2 py-1 text-[10px] tracking-[0.12em] text-amber-800 uppercase">
                                    Main Photo
                                  </span>
                                ) : null}
                                {isDirty ? (
                                  <span className="rounded-full border border-amber-500/80 bg-amber-100 px-2 py-1 text-[10px] tracking-[0.1em] text-amber-900 uppercase">
                                    Unsaved
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removePhotoFromHomepage(photo.photoId);
                                }}
                                className="rounded border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                              >
                                Remove
                              </button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>

                <aside className="rounded-2xl border border-line bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
                  {!homepageActivePhoto || !homepageActiveDraft ? (
                    <p className="text-sm text-muted">
                      Select a homepage photo in the sequence to edit title, caption, poem, and category.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="border-b border-line pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] tracking-[0.12em] text-muted uppercase">Editing Homepage Photo</p>
                            <p className="mt-1 text-base">
                              {homepageActiveDraft.title || homepageActivePhoto.title || "Untitled"}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {homepagePhotoIds[0] === homepageActivePhoto.photoId ? (
                                <span className="rounded bg-amber-500/90 px-2 py-0.5 text-[10px] tracking-[0.12em] text-black uppercase">
                                  Main Photo
                                </span>
                              ) : (
                                <span className="rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] tracking-[0.12em] text-white uppercase">
                                  On Homepage
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => savePhoto(homepageActivePhoto.photoId)}
                            disabled={
                              !homepageActiveIsDirty ||
                              savingPhotoId === homepageActivePhoto.photoId ||
                              deletingPhotoId === homepageActivePhoto.photoId
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded border border-foreground/30 text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label="Save homepage photo changes"
                            title={homepageActiveIsDirty ? "Save changes" : "No changes to save"}
                          >
                            <span className="h-4 w-4">
                              <SaveIcon />
                            </span>
                          </button>
                        </div>
                      </div>

                      <div className="relative aspect-[4/5] w-full overflow-hidden rounded border border-line bg-zinc-200">
                        <Image
                          src={homepageActivePhoto.thumbnailUrl || homepageActivePhoto.imageUrl}
                          alt={homepageActiveDraft.alt || homepageActiveDraft.title || "Homepage photo preview"}
                          fill
                          sizes="420px"
                          className="object-cover"
                        />
                      </div>

                      <label className="text-[10px] tracking-[0.12em] uppercase">
                        Title
                        <input
                          value={homepageActiveDraft.title}
                          onChange={(event) =>
                            handleDraftChange(homepageActivePhoto.photoId, "title", event.target.value)
                          }
                          className="mt-1.5 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                        />
                      </label>

                      <label className="text-[10px] tracking-[0.12em] uppercase">
                        Alt Text
                        <input
                          value={homepageActiveDraft.alt}
                          onChange={(event) =>
                            handleDraftChange(homepageActivePhoto.photoId, "alt", event.target.value)
                          }
                          className="mt-1.5 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                        />
                      </label>

                      <label className="text-[10px] tracking-[0.12em] uppercase">
                        Collection
                        <select
                          value={homepageActiveDraft.collection}
                          onChange={(event) =>
                            handleDraftChange(homepageActivePhoto.photoId, "collection", event.target.value)
                          }
                          className="mt-1.5 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                        >
                          {collectionOptions.map((collection) => (
                            <option key={`homepage-${collection}`} value={collection}>
                              {collection}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="grid gap-2 rounded border border-line bg-white/70 p-2 sm:grid-cols-2">
                        <label className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase">
                          <input
                            type="checkbox"
                            checked
                            onChange={(event) => {
                              if (!event.target.checked) {
                                removePhotoFromHomepage(homepageActivePhoto.photoId);
                              }
                            }}
                            className="h-4 w-4 accent-foreground"
                          />
                          On Homepage
                        </label>
                        <label className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase">
                          <input
                            type="checkbox"
                            checked={Boolean(homepageActiveDraft.published)}
                            onChange={(event) =>
                              handleDraftChange(homepageActivePhoto.photoId, "published", event.target.checked)
                            }
                            className="h-4 w-4 accent-foreground"
                          />
                          Published
                        </label>
                      </div>

                      <label className="text-[10px] tracking-[0.12em] uppercase">
                        Caption
                        <textarea
                          rows={4}
                          value={homepageActiveDraft.caption}
                          onChange={(event) => {
                            handleDraftChange(homepageActivePhoto.photoId, "caption", event.target.value);
                            resizeTextarea(event.target);
                          }}
                          className="mt-1.5 min-h-[120px] w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                        />
                      </label>

                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] tracking-[0.12em] uppercase">Poem</p>
                          <button
                            type="button"
                            onClick={() => openPoemEditor("photo", homepageActivePhoto.photoId)}
                            className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                          >
                            Expand Editor
                          </button>
                        </div>
                        <PoemToolbar onInsert={insertPoemFormatting} />
                        <textarea
                          ref={editorPoemRef}
                          rows={7}
                          value={homepageActiveDraft.poem}
                          onChange={(event) => {
                            handleDraftChange(homepageActivePhoto.photoId, "poem", event.target.value);
                            resizeTextarea(event.target);
                          }}
                          className="mt-1.5 min-h-[170px] w-full border border-line px-3 py-2 text-sm leading-6 whitespace-pre-wrap normal-case outline-none focus:border-foreground"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => savePhoto(homepageActivePhoto.photoId)}
                          disabled={
                            savingPhotoId === homepageActivePhoto.photoId ||
                            deletingPhotoId === homepageActivePhoto.photoId
                          }
                          className="border border-foreground px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
                        >
                          {savingPhotoId === homepageActivePhoto.photoId ? "Saving..." : "Save Metadata"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDrafts((current) => ({
                              ...current,
                              [homepageActivePhoto.photoId]: toDraft(homepageActivePhoto),
                            }))
                          }
                          className="border border-line px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground"
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => removePhotoFromHomepage(homepageActivePhoto.photoId)}
                          className="border border-line px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground"
                        >
                          Remove From Homepage
                        </button>
                      </div>
                    </div>
                  )}
                </aside>
              </div>

              <section className="rounded-2xl border border-line bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[11px] tracking-[0.14em] uppercase">Published Library Picker</h3>
                    <p className="mt-2 text-sm text-muted">
                      Drag or add published photos into Homepage Sequence. Draft photos are excluded.
                    </p>
                  </div>
                  <p className="text-xs tracking-[0.12em] text-muted uppercase">
                    {filteredHomepageAvailablePhotos.length} available
                  </p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {filteredHomepageAvailablePhotos.map((photo) => (
                    <article key={photo.photoId} className="overflow-hidden rounded-xl border border-line bg-white">
                      <div className="relative aspect-[4/5] w-full bg-zinc-200">
                        <Image
                          src={photo.thumbnailUrl || photo.imageUrl}
                          alt={photo.alt || photo.title || "Published photo"}
                          fill
                          sizes="260px"
                          className="object-cover"
                        />
                      </div>
                      <div className="space-y-2 px-2 py-2">
                        <p className="truncate text-sm">{photo.title || "Untitled"}</p>
                        <p className="truncate text-[10px] tracking-[0.12em] text-muted uppercase">{photo.collection}</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => handleHomepagePoolDragStart(event, photo.photoId)}
                            className="flex-1 rounded border border-line px-2 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                          >
                            Drag
                          </button>
                          <button
                            type="button"
                            onClick={() => addPhotoToHomepage(photo.photoId)}
                            disabled={homepagePhotoIds.length >= HOMEPAGE_MAX_PHOTOS}
                            className="flex-1 rounded border border-line px-2 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-45"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {!homepageLoading && filteredHomepageAvailablePhotos.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">
                    {homepageSearchTerm ? "No published photos match this search." : "No more published photos available to add."}
                  </p>
                ) : null}
              </section>
            </>
          ) : (
          <>
          <div className="rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,245,240,0.9)_100%)] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.08)]">
            <div className="mb-3">
              <h2 className="text-sm tracking-[0.14em] uppercase">
                {isDraftsTab ? "Draft Library" : "Photo Library"}
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
              <label className="text-[10px] tracking-[0.12em] uppercase">
                Search
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Title, caption, poem"
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                />
              </label>

              <label className="text-[10px] tracking-[0.12em] uppercase">
                Collection
                <select
                  value={collectionFilter}
                  onChange={(event) => {
                    setPage(1);
                    setCollectionFilter(event.target.value);
                  }}
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                >
                  <option value="All">All</option>
                  {collectionOptions.map((collection) => (
                    <option key={collection} value={collection}>
                      {collection}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[10px] tracking-[0.12em] uppercase">
                Visibility
                <select
                  value={effectivePublishedFilter}
                  onChange={(event) => {
                    setPage(1);
                    setPublishedFilter(event.target.value);
                  }}
                  disabled={isDraftsTab}
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                >
                  <option value="all">All</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </label>

              <label className="text-[10px] tracking-[0.12em] uppercase">
                Sort
                <select
                  value={librarySort}
                  onChange={(event) => {
                    setPage(1);
                    setLibrarySort(event.target.value);
                  }}
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                >
                  {librarySortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[10px] tracking-[0.12em] uppercase">
                Per Page
                <select
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPage(1);
                    setPageSize(Number(event.target.value));
                  }}
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => setShowLibraryHelp((current) => !current)}
                className="self-end border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                {showLibraryHelp ? "Hide Help" : "Show Help"}
              </button>
            </div>

            {isDraftsTab ? (
              <p className="mt-3 text-sm text-muted">
                Draft vault view: all unpublished photos are listed here so you can review and publish later.
              </p>
            ) : null}

            {!isDraftsTab ? (
              <p className="mt-3 text-sm text-muted">
                Sort mode:{" "}
                <span className="font-medium text-foreground">
                  {librarySortOptions.find((option) => option.value === librarySort)?.label || "Newest First"}
                </span>
                {canManualReorder
                  ? " (drag cards and save order)."
                  : " (switch to Manual Order to drag-reorder)."}
              </p>
            ) : null}

            {showLibraryHelp ? (
              <div className="mt-4 border border-foreground/20 bg-white p-3 text-sm text-foreground/80">
                <p>
                  `Published` means visible on public pages. `Draft` stays private in admin only.
                  Use the `Homepage` tab to set homepage photos and Main Photo. Drag cards to reorder this library,
                  then click `Save Order`.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
            <div className="flex flex-wrap items-center gap-2">
              {canManualReorder ? (
                <>
                  <button
                    type="button"
                    onClick={savePhotoOrder}
                    disabled={!hasOrderChanges || isSavingOrder || loadingPhotos}
                    className="border border-foreground px-3 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
                  >
                    {isSavingOrder ? "Saving..." : "Save Order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotos((current) => {
                        const map = new Map(current.map((item) => [item.photoId, item]));
                        const restored = baseOrderRef.current
                          .map((photoId) => map.get(photoId))
                          .filter(Boolean);
                        return restored.length === current.length ? restored : current;
                      });
                      setHasOrderChanges(false);
                      setDraggingPhotoId("");
                      setDragOverPhotoId("");
                    }}
                    disabled={!hasOrderChanges || isSavingOrder || loadingPhotos}
                    className="border border-line px-3 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground disabled:opacity-50"
                  >
                    Reset Order
                  </button>
                </>
              ) : (
                <p className="rounded border border-line px-3 py-2 text-[10px] tracking-[0.12em] text-muted uppercase">
                  Drag reorder is available in Manual Order mode.
                </p>
              )}
              <button
                type="button"
                onClick={toggleSelectAll}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground"
              >
                {photos.length > 0 && selectedCount === photos.length ? "Clear All" : "Select All"}
              </button>
              <p className="text-xs text-muted">
                {selectedCount} selected on this page {canManualReorder && hasOrderChanges ? "• Order has unsaved changes" : ""}
              </p>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-[10px] tracking-[0.12em] uppercase">
                Move Selected To
                <select
                  value={bulkCollection}
                  onChange={(event) => setBulkCollection(event.target.value)}
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                  disabled={isBulkRunning}
                >
                  {collectionOptions.map((collection) => (
                    <option key={collection} value={collection}>
                      {collection}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => runBulkPatch({ collection: bulkCollection }, "Collection updated for selected photos.")}
                disabled={isBulkRunning}
                className="self-end border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-50"
              >
                Apply Collection
              </button>

              <button
                type="button"
                onClick={() => runBulkPatch({ published: false }, "Selected photos moved to draft.")}
                disabled={isBulkRunning}
                className="self-end border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-50"
              >
                Draft Selected
              </button>

              <button
                type="button"
                onClick={runBulkDelete}
                disabled={isBulkRunning}
                className="self-end border border-red-600 px-3 py-2 text-[10px] tracking-[0.12em] text-red-700 uppercase transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50"
              >
                Delete Selected
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.05)]">
            <h3 className="text-[11px] tracking-[0.14em] uppercase">Category Manager</h3>
            <p className="mt-2 text-sm text-muted">
              Add categories, rename existing category names, or move all photos from one category to another.
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="border border-line p-3">
                <p className="text-[10px] tracking-[0.12em] uppercase">Add Category</p>
                <input
                  value={newCollectionName}
                  onChange={(event) => setNewCollectionName(event.target.value)}
                  placeholder="e.g. Rooftop Stories"
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                />
                <button
                  type="button"
                  onClick={addCollectionOption}
                  className="mt-2 w-full border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                >
                  Add
                </button>
              </div>

              <div className="border border-line p-3">
                <p className="text-[10px] tracking-[0.12em] uppercase">Rename Category</p>
                <select
                  value={renameFromCollection}
                  onChange={(event) => setRenameFromCollection(event.target.value)}
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                >
                  <option value="">Select category</option>
                  {collectionOptions.map((collection) => (
                    <option key={`rename-${collection}`} value={collection}>
                      {collection}
                    </option>
                  ))}
                </select>
                <input
                  value={renameToCollection}
                  onChange={(event) => setRenameToCollection(event.target.value)}
                  placeholder="New category name"
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                />
                <button
                  type="button"
                  onClick={runRenameCollection}
                  disabled={isUpdatingCollections}
                  className="mt-2 w-full border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-45"
                >
                  Rename
                </button>
              </div>

              <div className="border border-line p-3">
                <p className="text-[10px] tracking-[0.12em] uppercase">Move Category Photos</p>
                <select
                  value={moveFromCollection}
                  onChange={(event) => setMoveFromCollection(event.target.value)}
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                >
                  <option value="">From category</option>
                  {collectionOptions.map((collection) => (
                    <option key={`from-${collection}`} value={collection}>
                      {collection}
                    </option>
                  ))}
                </select>
                <select
                  value={moveToCollection}
                  onChange={(event) => setMoveToCollection(event.target.value)}
                  className="mt-2 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                >
                  {collectionOptions.map((collection) => (
                    <option key={`to-${collection}`} value={collection}>
                      {collection}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={runMoveCollection}
                  disabled={isUpdatingCollections}
                  className="mt-2 w-full border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-45"
                >
                  Move
                </button>
              </div>
            </div>
          </div>

          {manageMessage ? (
            <p className={`text-sm ${manageStatus === "error" ? "text-red-700" : "text-muted"}`}>
              {manageMessage}
            </p>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(320px,1fr)]">
            <section className="border border-line p-4">
              {loadingPhotos ? (
                <p className="text-sm text-muted">Loading library...</p>
              ) : photos.length === 0 ? (
                <p className="text-sm text-muted">No photos found for current filters.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {photos.map((photo) => {
                      const draft = drafts[photo.photoId] || toDraft(photo);
                      const isDirty = isDraftDirty(photo, draft);
                      const isSelected = selectedSet.has(photo.photoId);
                      const isActive = activePhotoId === photo.photoId;
                      const isDragging = draggingPhotoId === photo.photoId;
                      const isDropTarget = dragOverPhotoId === photo.photoId;

                      return (
                        <article
                          key={photo.photoId}
                          draggable={canManualReorder}
                          onDragStart={(event) => handleCardDragStart(event, photo.photoId)}
                          onDragOver={(event) => handleCardDragOver(event, photo.photoId)}
                          onDrop={(event) => handleCardDrop(event, photo.photoId)}
                          onDragEnd={handleCardDragEnd}
                          className={`group overflow-hidden border bg-white text-left transition-all ${
                            isActive
                              ? "border-foreground shadow-[0_10px_24px_rgba(0,0,0,0.09)]"
                            : isDropTarget
                              ? "border-foreground/80 ring-1 ring-foreground/25"
                                : isSelected
                                  ? "border-foreground/50"
                                  : "border-line hover:border-foreground/70"
                          } ${isDragging ? "opacity-70" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => requestPhotoSelection(photo.photoId)}
                            className="block w-full text-left"
                          >
                            <div className="relative aspect-[4/5] w-full bg-zinc-200">
                              <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex flex-wrap gap-1">
                                <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-white">
                                  {photo.published === false ? "Draft" : "Live"}
                                </span>
                                {photo.featured && photo.featuredOrder === 0 ? (
                                  <span className="rounded bg-amber-500/95 px-2 py-0.5 text-[10px] text-black">
                                    Main
                                  </span>
                                ) : photo.featured ? (
                                  <span className="rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] text-white">
                                    Homepage
                                  </span>
                                ) : null}
                              </div>
                              {isDirty ? (
                                <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded bg-amber-500 px-2 py-0.5 text-[10px] text-black">
                                  Unsaved
                                </span>
                              ) : null}
                            <Image
                              src={photo.thumbnailUrl || photo.imageUrl}
                              alt={photo.alt || photo.title || "Photo thumbnail"}
                              fill
                              sizes="(max-width: 1024px) 33vw, 20vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                            </div>
                            <div className="space-y-1 px-2 py-2">
                              <p className="truncate text-base">{photo.title || "Untitled"}</p>
                              <p className="truncate text-[11px] tracking-[0.12em] text-muted uppercase">
                                {photo.collection}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center justify-between border-t border-line px-2 py-2">
                            <label className="inline-flex items-center" title="Select photo">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectPhoto(photo.photoId)}
                                aria-label={`Select ${photo.title || "photo"}`}
                                className="h-4 w-4 accent-foreground"
                              />
                            </label>
                            <span
                              aria-hidden="true"
                              title={canManualReorder ? "Drag card to reorder" : "Enable Manual Order to drag"}
                              className={`inline-flex items-center ${canManualReorder ? "text-muted/80" : "text-muted/45"}`}
                            >
                              <svg
                                viewBox="0 0 12 12"
                                className="h-4 w-4"
                                fill="currentColor"
                              >
                                <circle cx="3" cy="2.5" r="0.9" />
                                <circle cx="3" cy="6" r="0.9" />
                                <circle cx="3" cy="9.5" r="0.9" />
                                <circle cx="9" cy="2.5" r="0.9" />
                                <circle cx="9" cy="6" r="0.9" />
                                <circle cx="9" cy="9.5" r="0.9" />
                              </svg>
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-xs text-muted">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1}
                        className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page >= totalPages}
                        className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <aside
              ref={editorPanelRef}
              className="border border-line bg-white p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
            >
              {!activePhoto || !activeDraft ? (
                <p className="text-sm text-muted">Select a photo from the grid to edit details.</p>
              ) : (
                <div className="space-y-3">
                  <div className="border-b border-line pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] tracking-[0.12em] text-muted uppercase">Editing</p>
                        <p className="mt-1 text-base">{activeDraft.title || activePhoto.title || "Untitled"}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {activePhoto.featured && activePhoto.featuredOrder === 0 ? (
                            <span className="rounded bg-amber-500/90 px-2 py-0.5 text-[10px] tracking-[0.12em] text-black uppercase">
                              Main Photo
                            </span>
                          ) : activePhoto.featured ? (
                            <span className="rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] tracking-[0.12em] text-white uppercase">
                              On Homepage
                            </span>
                          ) : (
                            <span className="rounded border border-line px-2 py-0.5 text-[10px] tracking-[0.12em] text-muted uppercase">
                              Not On Homepage
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => savePhoto(activePhoto.photoId)}
                        disabled={
                          !activeIsDirty ||
                          savingPhotoId === activePhoto.photoId ||
                          deletingPhotoId === activePhoto.photoId
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded border border-foreground/30 text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Save photo changes"
                        title={activeIsDirty ? "Save changes" : "No changes to save"}
                      >
                        <span className="h-4 w-4">
                          <SaveIcon />
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-200">
                    <Image
                      src={activePhoto.thumbnailUrl || activePhoto.imageUrl}
                      alt={activeDraft.alt || activeDraft.title || "Photo preview"}
                      fill
                      sizes="420px"
                      className="object-cover"
                    />
                  </div>

                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Title
                    <input
                      value={activeDraft.title}
                      onChange={(event) => handleDraftChange(activePhoto.photoId, "title", event.target.value)}
                      className="mt-1.5 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                      disabled={Boolean(savingPhotoId || deletingPhotoId)}
                    />
                  </label>

                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Alt Text
                    <input
                      value={activeDraft.alt}
                      onChange={(event) => handleDraftChange(activePhoto.photoId, "alt", event.target.value)}
                      className="mt-1.5 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                      disabled={Boolean(savingPhotoId || deletingPhotoId)}
                    />
                  </label>

                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Collection
                    <select
                      value={activeDraft.collection}
                      onChange={(event) => handleDraftChange(activePhoto.photoId, "collection", event.target.value)}
                      className="mt-1.5 w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                      disabled={Boolean(savingPhotoId || deletingPhotoId)}
                    >
                      {collectionOptions.map((collection) => (
                        <option key={collection} value={collection}>
                          {collection}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-2 rounded border border-line bg-white/70 p-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase">
                      <input
                        type="checkbox"
                        checked={Boolean(activeDraft.featured)}
                        onChange={(event) =>
                          handleDraftChange(activePhoto.photoId, "featured", event.target.checked)
                        }
                        className="h-4 w-4 accent-foreground"
                      />
                      On Homepage
                    </label>
                    <label className="flex items-center gap-2 text-[10px] tracking-[0.12em] uppercase">
                      <input
                        type="checkbox"
                        checked={Boolean(activeDraft.published)}
                        onChange={(event) =>
                          handleDraftChange(activePhoto.photoId, "published", event.target.checked)
                        }
                        className="h-4 w-4 accent-foreground"
                      />
                      Published
                    </label>
                  </div>
                  <p className="text-xs leading-5 text-muted">
                    Published photos can appear publicly. Use the Homepage tab to set exact homepage order and main photo.
                    If unpublished, this photo stays private in Drafts.
                  </p>

                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Caption
                    <textarea
                      rows={4}
                      value={activeDraft.caption}
                      onChange={(event) => {
                        handleDraftChange(activePhoto.photoId, "caption", event.target.value);
                        resizeTextarea(event.target);
                      }}
                      className="mt-1.5 min-h-[120px] w-full border border-line px-3 py-2 text-sm normal-case outline-none focus:border-foreground"
                      disabled={Boolean(savingPhotoId || deletingPhotoId)}
                    />
                  </label>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] tracking-[0.12em] uppercase">Poem</p>
                      <button
                        type="button"
                        onClick={() => openPoemEditor("photo", activePhoto.photoId)}
                        className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                      >
                        Expand Editor
                      </button>
                    </div>
                    <PoemToolbar onInsert={insertPoemFormatting} />
                    <textarea
                      ref={editorPoemRef}
                      rows={6}
                      value={activeDraft.poem}
                      onChange={(event) => {
                        handleDraftChange(activePhoto.photoId, "poem", event.target.value);
                        resizeTextarea(event.target);
                      }}
                      className="mt-1.5 min-h-[150px] w-full border border-line px-3 py-2 text-sm leading-6 whitespace-pre-wrap normal-case outline-none focus:border-foreground"
                      disabled={Boolean(savingPhotoId || deletingPhotoId)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => savePhoto(activePhoto.photoId)}
                      disabled={savingPhotoId === activePhoto.photoId || deletingPhotoId === activePhoto.photoId}
                      className="border border-foreground px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
                    >
                      {savingPhotoId === activePhoto.photoId ? "Saving..." : "Save"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((current) => ({
                          ...current,
                          [activePhoto.photoId]: toDraft(activePhoto),
                        }))
                      }
                      disabled={savingPhotoId === activePhoto.photoId || deletingPhotoId === activePhoto.photoId}
                      className="border border-line px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground disabled:opacity-50"
                    >
                      Reset
                    </button>

                    <button
                      type="button"
                      onClick={() => deletePhoto(activePhoto)}
                      disabled={savingPhotoId === activePhoto.photoId || deletingPhotoId === activePhoto.photoId}
                      className="border border-red-600 px-4 py-2 text-[10px] tracking-[0.14em] text-red-700 uppercase transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50"
                    >
                      {deletingPhotoId === activePhoto.photoId ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
          </>
          )}
        </section>
      )}

      {workspaceSwitchPrompt.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]">
          <div className="relative w-full max-w-lg">
            <span className="pointer-events-none absolute -top-7 left-10 h-14 w-14 rounded-full bg-white/95 shadow-[0_8px_18px_rgba(0,0,0,0.15)]" />
            <span className="pointer-events-none absolute -top-10 left-24 h-16 w-16 rounded-full bg-white/95 shadow-[0_8px_18px_rgba(0,0,0,0.15)]" />
            <span className="pointer-events-none absolute -top-6 left-40 h-12 w-12 rounded-full bg-white/95 shadow-[0_8px_18px_rgba(0,0,0,0.15)]" />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Unsaved changes before switching tab"
              className="rounded-3xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,245,240,0.94)_100%)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
            >
              <p className="text-[10px] tracking-[0.16em] text-muted uppercase">Thought Bubble</p>
              <h3 className="mt-2 text-xl">Save before switching views?</h3>
              <p className="mt-3 text-sm leading-6 text-foreground/80">
                You have unsaved changes. Do you want to save first, or continue without saving?
              </p>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelWorkspaceSwitch}
                  className="rounded-full border border-line px-4 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={discardPendingChangesAndSwitchTab}
                  className="rounded-full border border-line px-4 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                >
                  Continue Without Saving
                </button>
                <button
                  type="button"
                  onClick={savePendingChangesAndSwitchTab}
                  disabled={isSavingBeforeWorkspaceSwitch}
                  className="rounded-full border border-foreground bg-foreground px-4 py-2 text-[10px] tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-45"
                >
                  {isSavingBeforeWorkspaceSwitch ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {switchPrompt.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes confirmation"
            className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.25)]"
          >
            <h3 className="text-sm tracking-[0.14em] uppercase">Unsaved Changes</h3>
            <p className="mt-3 text-sm leading-6 text-foreground/80">
              You have unsaved edits on this photo. Save before switching to another photo?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelPhotoSwitch}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={discardAndSwitch}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveAndSwitch}
                disabled={Boolean(savingPhotoId)}
                className="border border-foreground bg-foreground px-3 py-2 text-[10px] tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savingPhotoId ? "Saving..." : "Save & Switch"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {poemModal.open ? (
        <div
          className="fixed inset-0 z-50 bg-black/75 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePoemEditor();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Expanded poem editor"
            className="mx-auto flex h-full max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_72px_rgba(0,0,0,0.32)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
              <div>
                <h3 className="text-sm tracking-[0.14em] uppercase">Expanded Poem Editor</h3>
                <p className="mt-1 text-xs text-muted">
                  {poemModal.mode === "upload"
                    ? "Editing upload template poem."
                    : `Editing: ${drafts[poemModal.photoId]?.title || "Untitled"}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closePoemEditor}
                className="rounded border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <PoemToolbar onInsert={insertPoemFormatting} />

              <textarea
                ref={modalPoemRef}
                value={modalPoemValue}
                onChange={(event) => {
                  updatePoemValue(poemModal.mode, poemModal.photoId, event.target.value);
                  resizeTextarea(event.target);
                }}
                rows={16}
                className="min-h-[300px] w-full border border-line px-3 py-3 text-sm leading-7 whitespace-pre-wrap normal-case outline-none focus:border-foreground"
              />

              <details className="mt-4 border border-line bg-zinc-50">
                <summary className="cursor-pointer px-3 py-2 text-[10px] tracking-[0.12em] text-muted uppercase">
                  Preview Text
                </summary>
                <div className="border-t border-line px-3 py-3">
                  <p className="text-sm leading-7 whitespace-pre-wrap">{modalPoemValue || "No poem text yet."}</p>
                </div>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
