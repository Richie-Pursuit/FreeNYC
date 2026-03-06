"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const CSRF_HEADER_NAME = "x-csrf-token";
const PAGE_SIZE_OPTIONS = [24, 48, 96];
const HOMEPAGE_MAX_PHOTOS = 100;
const HOMEPAGE_COLLECTION_FILTER = "__homepage__";
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

function areDraftValuesEqual(a, b) {
  if (!a || !b) {
    return false;
  }

  return (
    toStringValue(a.title) === toStringValue(b.title) &&
    toStringValue(a.alt) === toStringValue(b.alt) &&
    toStringValue(a.caption) === toStringValue(b.caption) &&
    toStringValue(a.poem) === toStringValue(b.poem) &&
    toStringValue(a.collection) === toStringValue(b.collection) &&
    Boolean(a.featured) === Boolean(b.featured) &&
    Boolean(a.published) === Boolean(b.published)
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

function getEdgeAutoScrollDelta(pointerY, top, bottom, threshold, minSpeed, maxSpeed) {
  if (
    !Number.isFinite(pointerY) ||
    !Number.isFinite(top) ||
    !Number.isFinite(bottom) ||
    bottom <= top
  ) {
    return 0;
  }

  const topZone = top + threshold;
  const bottomZone = bottom - threshold;

  if (pointerY < topZone) {
    const ratio = Math.min(1, (topZone - pointerY) / threshold);
    const eased = ratio * ratio;
    return -Math.round(minSpeed + (maxSpeed - minSpeed) * eased);
  }

  if (pointerY > bottomZone) {
    const ratio = Math.min(1, (pointerY - bottomZone) / threshold);
    const eased = ratio * ratio;
    return Math.round(minSpeed + (maxSpeed - minSpeed) * eased);
  }

  return 0;
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

function renderPoemInline(value, keyPrefix = "poem") {
  const text = typeof value === "string" ? value : "";
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const parts = [];
  let cursor = 0;
  let match;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(
        <span key={`${keyPrefix}-text-${index}`}>
          {text.slice(cursor, match.index)}
        </span>,
      );
      index += 1;
    }

    if (typeof match[1] === "string") {
      parts.push(
        <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold">
          {match[1]}
        </strong>,
      );
    } else if (typeof match[2] === "string") {
      parts.push(
        <em key={`${keyPrefix}-italic-${index}`} className="italic">
          {match[2]}
        </em>,
      );
    }
    index += 1;
    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    parts.push(
      <span key={`${keyPrefix}-tail-${index}`}>
        {text.slice(cursor)}
      </span>,
    );
  }

  return parts.length ? parts : [text];
}

function PoemLivePreview({ value, emptyText = "Preview will appear here.", className = "" }) {
  const lines = typeof value === "string" ? value.split("\n") : [];
  const hasContent = lines.some((line) => line.trim().length > 0);

  return (
    <div className={`rounded-md border border-line bg-zinc-50/80 px-3 py-2.5 ${className}`}>
      <p className="text-[10px] tracking-[0.12em] text-muted uppercase">Live Preview</p>
      <div className="mt-2 space-y-1 text-sm leading-7 text-foreground/90">
        {hasContent ? (
          lines.map((line, lineIndex) => (
            <p key={`preview-line-${lineIndex}`} className="whitespace-pre-wrap">
              {line.trim().length > 0 ? renderPoemInline(line, `line-${lineIndex}`) : " "}
            </p>
          ))
        ) : (
          <p className="italic text-muted">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 8H4V4" />
      <path d="M4 8a8 8 0 1 1-1 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 4h6l1 3H8l1-3Z" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
  disabled = false,
  description = "",
  tone = "default",
}) {
  const surfaceToneClass =
    checked && tone === "homepage"
      ? "border-emerald-200 bg-emerald-50/70"
      : checked && tone === "published"
        ? "border-sky-200 bg-sky-50/70"
        : "border-line bg-white";
  const trackToneClass =
    tone === "homepage"
      ? "peer-checked:bg-emerald-600"
      : tone === "published"
        ? "peer-checked:bg-sky-600"
        : "peer-checked:bg-foreground";

  return (
    <label className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 ${surfaceToneClass}`}>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
          aria-label={label}
        />
        <span
          className={`absolute inset-0 rounded-full bg-zinc-300 transition peer-disabled:opacity-50 ${trackToneClass}`}
        />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5 peer-disabled:opacity-70" />
      </span>
    </label>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("library");

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
  const [bulkMoveCollection, setBulkMoveCollection] = useState("City Life");
  const [activePhotoId, setActivePhotoId] = useState("");
  const [homepageActivePhotoId, setHomepageActivePhotoId] = useState("");
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [savingPhotoId, setSavingPhotoId] = useState("");
  const [deletingPhotoId, setDeletingPhotoId] = useState("");
  const [showLibraryHelp, setShowLibraryHelp] = useState(false);
  const [showLibraryToolsMenu, setShowLibraryToolsMenu] = useState(false);
  const [categoryToolMode, setCategoryToolMode] = useState("add");
  const [isLibraryEditorOpen, setIsLibraryEditorOpen] = useState(false);
  const [showLibraryPoemFormatting, setShowLibraryPoemFormatting] = useState(false);
  const [showUploadPoemFormatting, setShowUploadPoemFormatting] = useState(false);
  const [showUploadPoemPreview, setShowUploadPoemPreview] = useState(false);
  const [showLibraryPoemPreview, setShowLibraryPoemPreview] = useState(false);
  const [showHomepagePoemPreview, setShowHomepagePoemPreview] = useState(false);
  const [showModalPoemPreview, setShowModalPoemPreview] = useState(false);
  const [homepagePool, setHomepagePool] = useState([]);
  const [homepagePhotoIds, setHomepagePhotoIds] = useState([]);
  const [homepageSearchInput, setHomepageSearchInput] = useState("");
  const [homepageLoading, setHomepageLoading] = useState(false);
  const [homepageStatus, setHomepageStatus] = useState("idle");
  const [homepageMessage, setHomepageMessage] = useState("");
  const [homepageDraggingPhotoId, setHomepageDraggingPhotoId] = useState("");
  const [homepageDragOverPhotoId, setHomepageDragOverPhotoId] = useState("");
  const [isHomepageEditorOpen, setIsHomepageEditorOpen] = useState(false);
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
  const [isAutoSavingHomepageOrder, setIsAutoSavingHomepageOrder] = useState(false);
  const [autoSavingPhotoId, setAutoSavingPhotoId] = useState("");
  const [lastOrderSnapshot, setLastOrderSnapshot] = useState([]);
  const [libraryOriginalSnapshot, setLibraryOriginalSnapshot] = useState({
    photoId: "",
    draft: null,
  });
  const [switchPrompt, setSwitchPrompt] = useState({
    open: false,
    nextPhotoId: "",
  });
  const [libraryExitPrompt, setLibraryExitPrompt] = useState({
    open: false,
  });
  const [reorderConfirmPrompt, setReorderConfirmPrompt] = useState({
    open: false,
    sortLabel: "",
    nextOrderIds: [],
    previousOrderIds: [],
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
  const libraryToolsRef = useRef(null);
  const homepageSequenceRef = useRef(null);
  const libraryAutoSaveTimerRef = useRef(null);
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
  const isHomepageCollectionFilter = collectionFilter === HOMEPAGE_COLLECTION_FILTER;
  const canManualReorder = isLibraryTab && !isDraftsTab;
  const effectivePublishedFilter = isDraftsTab ? "draft" : publishedFilter;
  const librarySortOptions = useMemo(
    () =>
      isDraftsTab
        ? LIBRARY_SORT_OPTIONS.filter(
            (option) => option.value !== "manual" && option.value !== "curated",
          )
        : LIBRARY_SORT_OPTIONS.filter((option) => option.value !== "manual"),
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
  const hasOriginalSnapshotForActivePhoto = useMemo(
    () => libraryOriginalSnapshot.photoId === activePhotoId && Boolean(libraryOriginalSnapshot.draft),
    [activePhotoId, libraryOriginalSnapshot.draft, libraryOriginalSnapshot.photoId],
  );
  const canRestoreOriginal = useMemo(() => {
    if (!hasOriginalSnapshotForActivePhoto || !activeDraft) {
      return false;
    }
    return isDraftDirty(libraryOriginalSnapshot.draft, activeDraft);
  }, [activeDraft, hasOriginalSnapshotForActivePhoto, libraryOriginalSnapshot.draft]);
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
  const currentLibrarySortLabel = useMemo(
    () => librarySortOptions.find((option) => option.value === librarySort)?.label || librarySort,
    [librarySort, librarySortOptions],
  );
  const currentLibraryVisibilityLabel = useMemo(() => {
    if (effectivePublishedFilter === "published") {
      return "Published";
    }
    if (effectivePublishedFilter === "draft") {
      return "Draft";
    }
    return "All";
  }, [effectivePublishedFilter]);
  const currentLibraryViewLabel = useMemo(() => {
    if (collectionFilter === HOMEPAGE_COLLECTION_FILTER) {
      return "Homepage";
    }
    if (collectionFilter === "All") {
      return "All Collections";
    }
    return collectionFilter;
  }, [collectionFilter]);
  const libraryViewTone = useMemo(() => {
    if (isDraftsTab) {
      return {
        chip: "border-rose-300 bg-rose-50 text-rose-800",
        dot: "bg-rose-600",
      };
    }
    if (isHomepageCollectionFilter) {
      return {
        chip: "border-emerald-300 bg-emerald-50 text-emerald-800",
        dot: "bg-emerald-600",
      };
    }
    if (collectionFilter !== "All") {
      return {
        chip: "border-amber-300 bg-amber-50 text-amber-800",
        dot: "bg-amber-500",
      };
    }
    return {
      chip: "border-zinc-300 bg-zinc-50 text-zinc-700",
      dot: "bg-zinc-500",
    };
  }, [collectionFilter, isDraftsTab, isHomepageCollectionFilter]);

  const getWorkspaceTabClass = useCallback((tabKey, isActive) => {
    const base =
      "rounded-md border px-4 py-2 text-[12px] tracking-[0.14em] uppercase transition-all";
    const map = {
      upload: {
        active: "border-sky-600 bg-sky-600 text-white shadow-[0_10px_24px_rgba(2,132,199,0.28)]",
        idle: "border-zinc-300 bg-white text-zinc-700 hover:border-sky-400 hover:text-sky-700",
      },
      homepage: {
        active: "border-emerald-600 bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.28)]",
        idle: "border-zinc-300 bg-white text-zinc-700 hover:border-emerald-400 hover:text-emerald-700",
      },
      library: {
        active: "border-amber-500 bg-amber-500 text-black shadow-[0_10px_24px_rgba(245,158,11,0.24)]",
        idle: "border-zinc-300 bg-white text-zinc-700 hover:border-amber-400 hover:text-amber-700",
      },
      drafts: {
        active: "border-rose-600 bg-rose-600 text-white shadow-[0_10px_24px_rgba(190,24,93,0.28)]",
        idle: "border-zinc-300 bg-white text-zinc-700 hover:border-rose-400 hover:text-rose-700",
      },
    };

    const tone = map[tabKey] || map.library;
    return `${base} ${isActive ? tone.active : tone.idle}`;
  }, []);

  const requestLibraryEditorClose = useCallback(() => {
    if (!isLibraryEditorOpen) {
      return;
    }

    if (!activePhotoId || !activePhoto || !activeDraft) {
      setLibraryExitPrompt({ open: false });
      setIsLibraryEditorOpen(false);
      return;
    }

    if (savingPhotoId === activePhotoId || deletingPhotoId === activePhotoId) {
      return;
    }

    if (activeIsDirty) {
      setLibraryExitPrompt({ open: true });
      return;
    }

    if (libraryAutoSaveTimerRef.current) {
      clearTimeout(libraryAutoSaveTimerRef.current);
      libraryAutoSaveTimerRef.current = null;
    }

    setLibraryExitPrompt({ open: false });
    setIsLibraryEditorOpen(false);
  }, [
    activeDraft,
    activeIsDirty,
    activePhoto,
    activePhotoId,
    deletingPhotoId,
    isLibraryEditorOpen,
    savingPhotoId,
  ]);

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
      const usingHomepageFilter = collectionFilter === HOMEPAGE_COLLECTION_FILTER;
      const requestedSort = usingHomepageFilter ? "curated" : librarySort;
      const requestedLimit = usingHomepageFilter ? HOMEPAGE_MAX_PHOTOS : pageSize;
      const requestedOffset = usingHomepageFilter ? 0 : (page - 1) * pageSize;

      const params = new URLSearchParams({
        sort: requestedSort,
        includeDrafts: "1",
        limit: String(requestedLimit),
        offset: String(requestedOffset),
      });
      if (usingHomepageFilter) {
        params.set("featured", "1");
      } else if (collectionFilter !== "All") {
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
      baseOrderRef.current = nextOrder;
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      setLastOrderSnapshot([]);
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
    if (!collectionOptions.length) {
      return;
    }
    if (!collectionOptions.includes(bulkMoveCollection)) {
      setBulkMoveCollection(collectionOptions[0]);
    }
  }, [bulkMoveCollection, collectionOptions]);

  useEffect(() => {
    if (canManualReorder) {
      return;
    }

    setDraggingPhotoId("");
    setDragOverPhotoId("");
    setLastOrderSnapshot([]);
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
    if (!isHomepageTab) {
      setIsHomepageEditorOpen(false);
    }
  }, [isHomepageTab]);

  useEffect(() => {
    if (!isLibraryTab) {
      setIsLibraryEditorOpen(false);
    }
  }, [isLibraryTab]);

  useEffect(() => {
    if (!isHomepageEditorOpen || homepageActivePhoto) {
      return;
    }

    setIsHomepageEditorOpen(false);
  }, [homepageActivePhoto, isHomepageEditorOpen]);

  useEffect(() => {
    if (!isHomepageEditorOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsHomepageEditorOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isHomepageEditorOpen]);

  useEffect(() => {
    if (!isLibraryEditorOpen || activePhoto) {
      return;
    }

    setLibraryExitPrompt({ open: false });
    setIsLibraryEditorOpen(false);
  }, [activePhoto, isLibraryEditorOpen]);

  useEffect(() => {
    if (!isLibraryEditorOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        requestLibraryEditorClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isLibraryEditorOpen, requestLibraryEditorClose]);

  useEffect(() => {
    if (!isLibraryEditorOpen) {
      setShowLibraryPoemFormatting(false);
      setShowLibraryPoemPreview(false);
      setLibraryExitPrompt({ open: false });
    }
  }, [isLibraryEditorOpen]);

  useEffect(() => {
    if (!isLibraryEditorOpen) {
      setLibraryOriginalSnapshot({
        photoId: "",
        draft: null,
      });
    }
  }, [isLibraryEditorOpen]);

  useEffect(() => {
    if (!isUploadTab) {
      setShowUploadPoemFormatting(false);
      setShowUploadPoemPreview(false);
    }
  }, [isUploadTab]);

  useEffect(() => {
    setShowLibraryPoemFormatting(false);
    setShowLibraryPoemPreview(false);
  }, [activePhotoId]);

  useEffect(() => {
    if (!isHomepageEditorOpen) {
      setShowHomepagePoemPreview(false);
    }
  }, [isHomepageEditorOpen]);

  useEffect(() => {
    if (isLibraryTab) {
      return;
    }

    setShowLibraryToolsMenu(false);
  }, [isLibraryTab]);

  useEffect(() => {
    if (!showLibraryToolsMenu) {
      return undefined;
    }

    const handleOutsidePointer = (event) => {
      const container = libraryToolsRef.current;
      if (!container || container.contains(event.target)) {
        return;
      }
      setShowLibraryToolsMenu(false);
    };

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
    };
  }, [showLibraryToolsMenu]);

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
    if (!isLibraryEditorOpen || !activePhotoId) {
      return;
    }

    setLibraryOriginalSnapshot((current) => {
      if (current.photoId === activePhotoId && current.draft) {
        return current;
      }

      const sourcePhoto =
        photos.find((photo) => photo.photoId === activePhotoId) ||
        homepagePool.find((photo) => photo.photoId === activePhotoId) ||
        null;
      const fallbackDraft = drafts[activePhotoId] || null;
      const nextDraft = sourcePhoto ? toDraft(sourcePhoto) : fallbackDraft ? { ...fallbackDraft } : null;

      if (!nextDraft) {
        return current;
      }

      return {
        photoId: activePhotoId,
        draft: nextDraft,
      };
    });
  }, [activePhotoId, drafts, homepagePool, isLibraryEditorOpen, photos]);

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

  const insertHomepagePoemFormatting = useCallback((before, after = before) => {
    const photoId = homepageActivePhoto?.photoId;
    const element = editorPoemRef.current;
    if (!photoId || !element) {
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const selected = element.value.slice(start, end);
    const replacement = `${before}${selected}${after}`;
    const nextValue = `${element.value.slice(0, start)}${replacement}${element.value.slice(end)}`;

    setDrafts((current) => ({
      ...current,
      [photoId]: {
        ...(current[photoId] || toDraft(homepagePhotoMap.get(photoId))),
        poem: nextValue,
      },
    }));

    requestAnimationFrame(() => {
      const currentElement = editorPoemRef.current;
      if (!currentElement) {
        return;
      }

      currentElement.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      currentElement.setSelectionRange(cursorStart, cursorEnd);
      resizeTextarea(currentElement);
    });
  }, [homepageActivePhoto, homepagePhotoMap]);

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
      setShowModalPoemPreview(false);
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

  const savePhoto = useCallback(async (photoId, options = {}) => {
    const {
      refreshHomepage = true,
      refreshLibrary = isLibraryTab,
      silent = false,
      background = false,
      draftOverride = null,
    } = options;
    const draft = draftOverride || drafts[photoId];
    if (!draft) {
      return false;
    }
    const draftSnapshot = { ...draft };

    if (background) {
      setAutoSavingPhotoId(photoId);
    } else {
      setSavingPhotoId(photoId);
    }
    if (!silent) {
      setManageStatus("idle");
      setManageMessage("");
    }

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
      setHomepagePool((current) =>
        current.map((photo) => (photo.photoId === photoId ? result.photo : photo)),
      );
      setDrafts((current) => ({
        ...current,
        [photoId]:
          background && current[photoId] && !areDraftValuesEqual(current[photoId], draftSnapshot)
            ? current[photoId]
            : toDraft(result.photo),
      }));
      setCollections((current) => mergeCollections(current, [result.photo.collection]));
      if (!silent) {
        setManageStatus("success");
        setManageMessage(`Saved ${result.photo.title || "photo"}.`);
      }
      if (refreshLibrary) {
        await loadLibraryData();
      }
      if (refreshHomepage) {
        await loadHomepageData();
      }
      return true;
    } catch (error) {
      setManageStatus("error");
      setManageMessage(
        silent ? `Auto-save failed: ${error.message || "Unable to save photo."}` : error.message || "Unable to save photo.",
      );
      return false;
    } finally {
      if (background) {
        setAutoSavingPhotoId("");
      } else {
        setSavingPhotoId("");
      }
    }
  }, [drafts, fetchWithCsrf, isLibraryTab, loadHomepageData, loadLibraryData]);

  useEffect(() => {
    if (!isLibraryEditorOpen || !activePhoto || !activeDraft || !activeIsDirty) {
      if (libraryAutoSaveTimerRef.current) {
        clearTimeout(libraryAutoSaveTimerRef.current);
        libraryAutoSaveTimerRef.current = null;
      }
      return;
    }

    if (
      savingPhotoId === activePhoto.photoId ||
      autoSavingPhotoId === activePhoto.photoId ||
      deletingPhotoId === activePhoto.photoId
    ) {
      return;
    }

    libraryAutoSaveTimerRef.current = setTimeout(() => {
      void savePhoto(activePhoto.photoId, {
        refreshHomepage: false,
        refreshLibrary: false,
        silent: true,
        background: true,
      });
    }, 1200);

    return () => {
      if (libraryAutoSaveTimerRef.current) {
        clearTimeout(libraryAutoSaveTimerRef.current);
        libraryAutoSaveTimerRef.current = null;
      }
    };
  }, [
    activeDraft,
    activeIsDirty,
    activePhoto,
    autoSavingPhotoId,
    deletingPhotoId,
    isLibraryEditorOpen,
    savePhoto,
    savingPhotoId,
  ]);

  const restoreActivePhotoToOriginal = useCallback(async () => {
    if (!activePhotoId || !hasOriginalSnapshotForActivePhoto || !libraryOriginalSnapshot.draft) {
      return;
    }
    if (savingPhotoId === activePhotoId || deletingPhotoId === activePhotoId) {
      return;
    }

    const restoredDraft = { ...libraryOriginalSnapshot.draft };
    setDrafts((current) => ({
      ...current,
      [activePhotoId]: restoredDraft,
    }));

    await savePhoto(activePhotoId, {
      draftOverride: restoredDraft,
      refreshHomepage: true,
      refreshLibrary: true,
    });
  }, [
    activePhotoId,
    deletingPhotoId,
    hasOriginalSnapshotForActivePhoto,
    libraryOriginalSnapshot.draft,
    savePhoto,
    savingPhotoId,
  ]);

  const cancelLibraryExitPrompt = () => {
    setLibraryExitPrompt({ open: false });
  };

  const discardAndCloseLibraryEditor = () => {
    if (libraryAutoSaveTimerRef.current) {
      clearTimeout(libraryAutoSaveTimerRef.current);
      libraryAutoSaveTimerRef.current = null;
    }

    if (activePhoto) {
      setDrafts((current) => ({
        ...current,
        [activePhoto.photoId]: toDraft(activePhoto),
      }));
    }

    setLibraryExitPrompt({ open: false });
    setIsLibraryEditorOpen(false);
  };

  const saveAndCloseLibraryEditor = async () => {
    if (!activePhoto) {
      setLibraryExitPrompt({ open: false });
      setIsLibraryEditorOpen(false);
      return;
    }

    if (libraryAutoSaveTimerRef.current) {
      clearTimeout(libraryAutoSaveTimerRef.current);
      libraryAutoSaveTimerRef.current = null;
    }

    const saved = await savePhoto(activePhoto.photoId);
    if (!saved) {
      return;
    }

    setLibraryExitPrompt({ open: false });
    setIsLibraryEditorOpen(false);
  };

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

  const persistLibraryOrder = useCallback(async (nextPhotos, previousOrderIds = []) => {
    if (!Array.isArray(nextPhotos) || nextPhotos.length < 2) {
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
          photoIds: nextPhotos.map((item) => item.photoId),
        }),
      }).then(parseJsonResponse);

      baseOrderRef.current = nextPhotos.map((item) => item.photoId);
      setLastOrderSnapshot(previousOrderIds);
      setManageStatus("success");
      setManageMessage("Order saved.");
      return true;
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to save order.");
      return false;
    } finally {
      setIsSavingOrder(false);
    }
  }, [fetchWithCsrf]);

  const saveHomepageOrderFromLibrary = useCallback(async (photoList) => {
    const orderedIds = Array.isArray(photoList)
      ? photoList.map((photo) => photo?.photoId).filter(Boolean)
      : [];
    if (orderedIds.length < 1) {
      return false;
    }

    setIsAutoSavingHomepageOrder(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      const result = await fetchWithCsrf("/api/photos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "setFeaturedOrder",
          photoIds: orderedIds,
        }),
      }).then(parseJsonResponse);

      const updatedPhotos = Array.isArray(result.photos) ? result.photos : photoList;
      const updatedIds = Array.isArray(result.photoIds) ? result.photoIds : orderedIds;
      baseHomepageOrderRef.current = updatedIds;

      setPhotos(updatedPhotos);
      setTotalPhotos(updatedPhotos.length);
      setHasHomepageChanges(false);
      setManageStatus("success");
      setManageMessage("Homepage sequence saved.");

      await loadHomepageData();
      return true;
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Unable to save homepage sequence.");
      return false;
    } finally {
      setIsAutoSavingHomepageOrder(false);
    }
  }, [fetchWithCsrf, loadHomepageData]);

  const handleCardDragStart = (event, photoId) => {
    if (!canManualReorder || isSavingOrder) {
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

  const handleCardDrop = async (event, photoId) => {
    if (!canManualReorder || isSavingOrder) {
      return;
    }
    event.preventDefault();
    const droppedPhotoId = event.dataTransfer.getData("text/plain") || draggingPhotoId;

    if (!droppedPhotoId || droppedPhotoId === photoId) {
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      return;
    }

    const nextPhotos = reorderPhotoList(photos, droppedPhotoId, photoId);
    if (nextPhotos === photos) {
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      return;
    }
    const previousPhotos = photos;
    const previousOrderIds = previousPhotos.map((item) => item.photoId);

    if (isHomepageCollectionFilter) {
      setPhotos(nextPhotos);
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      await saveHomepageOrderFromLibrary(nextPhotos);
      return;
    }
    if (librarySort !== "manual") {
      setDraggingPhotoId("");
      setDragOverPhotoId("");
      setReorderConfirmPrompt({
        open: true,
        sortLabel: librarySortOptions.find((option) => option.value === librarySort)?.label || librarySort,
        nextOrderIds: nextPhotos.map((item) => item.photoId),
        previousOrderIds,
      });
      return;
    }

    setPhotos(nextPhotos);
    setDraggingPhotoId("");
    setDragOverPhotoId("");
    const saved = await persistLibraryOrder(nextPhotos, previousOrderIds);
    if (!saved) {
      setPhotos(previousPhotos);
      return;
    }
    if (librarySort !== "manual") {
      setPage(1);
      setLibrarySort("manual");
    }
  };

  const cancelReorderConfirm = () => {
    setReorderConfirmPrompt({
      open: false,
      sortLabel: "",
      nextOrderIds: [],
      previousOrderIds: [],
    });
    setManageStatus("idle");
    setManageMessage("Reorder canceled.");
  };

  const confirmReorderChange = async () => {
    if (!reorderConfirmPrompt.open) {
      return;
    }

    const { nextOrderIds, previousOrderIds } = reorderConfirmPrompt;
    const map = new Map(photos.map((item) => [item.photoId, item]));
    const nextPhotos = nextOrderIds.map((photoId) => map.get(photoId)).filter(Boolean);
    const previousPhotos = previousOrderIds.map((photoId) => map.get(photoId)).filter(Boolean);

    if (nextPhotos.length !== photos.length) {
      setReorderConfirmPrompt({
        open: false,
        sortLabel: "",
        nextOrderIds: [],
        previousOrderIds: [],
      });
      setManageStatus("error");
      setManageMessage("Unable to apply reorder. Please try again.");
      return;
    }

    setReorderConfirmPrompt({
      open: false,
      sortLabel: "",
      nextOrderIds: [],
      previousOrderIds: [],
    });
    setPhotos(nextPhotos);
    const saved = await persistLibraryOrder(nextPhotos, previousOrderIds);
    if (!saved) {
      if (previousPhotos.length === photos.length) {
        setPhotos(previousPhotos);
      }
      return;
    }
    setPage(1);
    setLibrarySort("manual");
  };

  const handleCardDragEnd = () => {
    if (!canManualReorder) {
      return;
    }
    setDraggingPhotoId("");
    setDragOverPhotoId("");
  };

  const undoLastOrderChange = async () => {
    if (lastOrderSnapshot.length < 2 || photos.length < 2) {
      return;
    }

    const map = new Map(photos.map((item) => [item.photoId, item]));
    const restored = lastOrderSnapshot.map((photoId) => map.get(photoId)).filter(Boolean);
    if (restored.length !== photos.length) {
      setManageStatus("error");
      setManageMessage("Unable to restore previous order.");
      return;
    }

    const currentPhotos = photos;
    setPhotos(restored);
    const saved = await persistLibraryOrder(restored, []);
    if (!saved) {
      setPhotos(currentPhotos);
      return;
    }
    setLastOrderSnapshot([]);
    setManageStatus("success");
    setManageMessage("Order reverted.");
  };

  const requestPhotoSelection = (nextPhotoId) => {
    if (!nextPhotoId) {
      return;
    }

    if (nextPhotoId === activePhotoId) {
      setIsLibraryEditorOpen(true);
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
    setIsLibraryEditorOpen(true);
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
      setIsLibraryEditorOpen(true);
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
      setIsLibraryEditorOpen(true);
    }
  };

  const hasAnyPendingChanges = hasUnsavedChanges || hasHomepageChanges;

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
      if (hasHomepageChanges) {
        const homepageSaved = await saveHomepageSelection();
        if (!homepageSaved) {
          return;
        }
      }

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
          const saved = await savePhoto(photoId, { refreshHomepage: false });
          if (!saved) {
            return;
          }
        }

        await loadHomepageData();
      }

      setWorkspaceSwitchPrompt({ open: false, nextTab: "" });
      setPage(1);
      setActiveTab(nextTab);
    } finally {
      setIsSavingBeforeWorkspaceSwitch(false);
    }
  };

  const normalizeCollectionName = (value) => toStringValue(value).slice(0, 80);

  const autoScrollPageWhileDragging = useCallback((event) => {
    const delta = getEdgeAutoScrollDelta(
      event.clientY,
      0,
      window.innerHeight,
      180,
      2,
      10,
    );
    if (delta !== 0) {
      window.scrollBy(0, delta);
    }
  }, []);

  const autoScrollHomepageSequence = useCallback((event) => {
    const container = homepageSequenceRef.current;
    if (!container) {
      return;
    }

    const bounds = container.getBoundingClientRect();
    const delta = getEdgeAutoScrollDelta(
      event.clientY,
      bounds.top,
      bounds.bottom,
      96,
      1,
      7,
    );
    if (delta !== 0) {
      container.scrollTop += delta;
    }
  }, []);

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
      const featuredSet = new Set(next);
      const featuredOrderMap = new Map(next.map((photoId, index) => [photoId, index]));
      setHomepagePhotoIds(next);
      baseHomepageOrderRef.current = next;
      setHasHomepageChanges(false);
      setHomepagePool((current) =>
        current.map((photo) => {
          const nextOrder = featuredOrderMap.get(photo.photoId);
          const isFeatured = featuredSet.has(photo.photoId);
          return {
            ...photo,
            featured: isFeatured,
            featuredOrder: typeof nextOrder === "number" ? nextOrder : null,
          };
        }),
      );
      setPhotos((current) =>
        current.map((photo) => {
          const nextOrder = featuredOrderMap.get(photo.photoId);
          const isFeatured = featuredSet.has(photo.photoId);
          return {
            ...photo,
            featured: isFeatured,
            featuredOrder: typeof nextOrder === "number" ? nextOrder : null,
          };
        }),
      );
      setDrafts((current) => {
        const nextDrafts = { ...current };
        for (const photoId of Object.keys(nextDrafts)) {
          nextDrafts[photoId] = {
            ...nextDrafts[photoId],
            featured: featuredSet.has(photoId),
          };
        }
        return nextDrafts;
      });
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

  useEffect(() => {
    if (!homepageDraggingPhotoId && !draggingPhotoId) {
      return undefined;
    }

    const handleGlobalDragOver = (event) => {
      autoScrollPageWhileDragging(event);
    };

    window.addEventListener("dragover", handleGlobalDragOver);
    return () => window.removeEventListener("dragover", handleGlobalDragOver);
  }, [autoScrollPageWhileDragging, draggingPhotoId, homepageDraggingPhotoId]);

  const addCollectionOption = () => {
    const normalized = normalizeCollectionName(newCollectionName);
    if (!normalized) {
      setManageStatus("error");
      setManageMessage("Enter a collection name.");
      return;
    }

    setCollections((current) => mergeCollections(current, [normalized]));
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

  const runBulkMoveToCollection = async () => {
    if (selectedCount === 0) {
      setManageStatus("error");
      setManageMessage("Select at least one photo.");
      return;
    }

    const destination = normalizeCollectionName(bulkMoveCollection || "");
    if (!destination) {
      setManageStatus("error");
      setManageMessage("Choose a destination collection.");
      return;
    }

    const selectedPhotos = photos.filter((photo) => selectedSet.has(photo.photoId));
    const toMove = selectedPhotos.filter((photo) => photo.collection !== destination);
    const skippedCount = selectedPhotos.length - toMove.length;

    if (toMove.length === 0) {
      setManageStatus("success");
      setManageMessage(`No changes needed. All selected photos are already in "${destination}".`);
      return;
    }

    setIsBulkRunning(true);
    setManageStatus("idle");
    setManageMessage("");

    try {
      for (const photo of toMove) {
        await fetchWithCsrf(`/api/photos/${photo.photoId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ collection: destination }),
        }).then(parseJsonResponse);
      }

      await loadLibraryData();
      await loadHomepageData();
      setSelectedPhotoIds([]);
      setManageStatus("success");
      setManageMessage(
        `Moved ${toMove.length} photo(s) to "${destination}"${skippedCount > 0 ? `, skipped ${skippedCount} already there.` : "."}`,
      );
    } catch (error) {
      setManageStatus("error");
      setManageMessage(error.message || "Bulk move failed.");
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
    <main className="mx-auto w-full max-w-[1680px] px-4 py-8 text-[16px] text-foreground sm:px-8 sm:py-10 lg:px-12 [&_.text-muted]:text-foreground/74 [&_button]:font-semibold [&_button]:tracking-[0.06em] [&_button]:transition-all [&_button]:duration-150 [&_input]:rounded-md [&_input]:border-zinc-400 [&_input]:bg-white [&_input]:text-[16px] [&_input]:text-foreground [&_input:focus]:ring-2 [&_input:focus]:ring-foreground/20 [&_select]:rounded-md [&_select]:border-zinc-400 [&_select]:bg-white [&_select]:text-[16px] [&_select]:text-foreground [&_select:focus]:ring-2 [&_select:focus]:ring-foreground/20 [&_textarea]:rounded-md [&_textarea]:border-zinc-400 [&_textarea]:bg-white [&_textarea]:text-[16px] [&_textarea]:text-foreground [&_textarea:focus]:ring-2 [&_textarea:focus]:ring-foreground/20 [&_label]:font-semibold [&_label]:tracking-normal [&_label]:normal-case [&_summary]:tracking-normal [&_summary]:normal-case">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] tracking-[0.18em] text-muted uppercase">Admin Workspace</p>
          <h1 className="display-font mt-2 text-4xl leading-none text-foreground drop-shadow-[0_1px_0_rgba(0,0,0,0.1)] sm:text-5xl">Photo Control Room</h1>
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
          className={getWorkspaceTabClass("upload", isUploadTab)}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("homepage")}
          className={getWorkspaceTabClass("homepage", isHomepageTab)}
        >
          Homepage
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("library")}
          className={getWorkspaceTabClass("library", activeTab === "library")}
        >
          Library
        </button>
        <button
          type="button"
          onClick={() => requestWorkspaceTabChange("drafts")}
          className={getWorkspaceTabClass("drafts", isDraftsTab)}
        >
          Drafts
        </button>
      </div>

      {isUploadTab ? (
        <section className="mt-6 rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(252,249,244,0.95)_100%)] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.08)] sm:p-6">
          <header className="border-b border-line pb-4">
            <h2 className="text-2xl font-semibold text-foreground">Multi-photo upload</h2>
            <p className="mt-2 text-sm text-foreground/80">
              Streamlined uploader for repeated batches. Configure defaults once and apply across all selected files.
            </p>
          </header>

          <form onSubmit={handleUploadSubmit} className="mt-5 space-y-4">
            <section className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">1. Choose photos</h3>
                  <p className="mt-1 text-sm text-muted">Start by selecting one or more image files. This is the only required step.</p>
                </div>
                <span className="rounded-full border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-xs font-semibold text-foreground">
                  Required
                </span>
              </div>

              <input
                key={fileInputKey}
                id="upload-photo-files"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="sr-only"
                disabled={isUploading}
              />

              <label
                htmlFor="upload-photo-files"
                className="mt-3 block cursor-pointer rounded-xl border border-dashed border-zinc-400 bg-zinc-50 px-4 py-5 transition-colors hover:border-foreground hover:bg-zinc-100"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Drop images here or browse</p>
                    <p className="mt-1 text-sm text-muted">JPG, PNG, WEBP. Maximum 12MB per file.</p>
                  </div>
                  <span className="rounded-md border border-line bg-white px-3 py-2 text-xs text-foreground">
                    Choose files
                  </span>
                </div>
              </label>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-foreground">
                  {files.length} file(s) selected
                </span>
                <span className="text-xs text-muted">Limit: 12MB each</span>
              </div>

              {files.length > 0 ? (
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                  {files.slice(0, 6).map((file) => (
                    <p
                      key={`${file.name}-${file.size}`}
                      className="truncate rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-foreground/85"
                    >
                      {file.name}
                    </p>
                  ))}
                  {files.length > 6 ? (
                    <p className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-muted">
                      +{files.length - 6} more file(s)
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">2. Default metadata</h3>
                  <p className="mt-1 text-sm text-muted">Applied to each photo by default. You can edit per-photo later in Library.</p>
                </div>
                <span className="rounded-full border border-line bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-muted">
                  Core settings
                </span>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <label className="text-sm">
                  Title template
                  <input
                    name="title"
                    value={uploadForm.title}
                    onChange={handleUploadFieldChange}
                    type="text"
                    placeholder="Optional"
                    className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                    disabled={isUploading}
                  />
                </label>

                <label className="text-sm">
                  Alt text template
                  <input
                    name="alt"
                    value={uploadForm.alt}
                    onChange={handleUploadFieldChange}
                    type="text"
                    placeholder="Describe image for screen readers"
                    className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                    disabled={isUploading}
                  />
                </label>

                <label className="text-sm">
                  Collection
                  <select
                    name="collection"
                    value={uploadForm.collection}
                    onChange={handleUploadFieldChange}
                    className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                    disabled={isUploading}
                  >
                    {collectionOptions.map((collection) => (
                      <option key={collection} value={collection}>
                        {collection}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-lg font-semibold text-foreground">3. Publishing settings</h3>
              <p className="mt-1 text-sm text-muted">Control public visibility and whether uploads should appear on the homepage curation list.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ToggleSwitch
                  label="Feature on homepage"
                  checked={Boolean(uploadForm.featured)}
                  tone="homepage"
                  onChange={(event) =>
                    handleUploadFieldChange({
                      target: { name: "featured", type: "checkbox", checked: event.target.checked, value: "" },
                    })
                  }
                  disabled={isUploading}
                />
                <ToggleSwitch
                  label="Published on site"
                  checked={Boolean(uploadForm.published)}
                  tone="published"
                  onChange={(event) =>
                    handleUploadFieldChange({
                      target: { name: "published", type: "checkbox", checked: event.target.checked, value: "" },
                    })
                  }
                  disabled={isUploading}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                Published photos appear on public pages. Disable it to keep uploads private in Drafts.
              </p>
            </section>

            <section className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">4. Optional writing</h3>
                  <p className="mt-1 text-sm text-muted">Add caption or poem templates only if needed.</p>
                </div>
                <span className="rounded-full border border-line bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-muted">
                  Optional
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <details className="rounded-md border border-line bg-zinc-50/60">
                  <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-foreground">Caption template</summary>
                  <div className="border-t border-line bg-white px-3 py-3">
                    <textarea
                      name="caption"
                      value={uploadForm.caption}
                      onChange={handleUploadFieldChange}
                      rows={3}
                      className="min-h-[110px] w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                      disabled={isUploading}
                    />
                  </div>
                </details>

                <details className="rounded-md border border-line bg-zinc-50/60">
                  <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-foreground">Poem template</summary>
                  <div className="border-t border-line bg-white px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Poem editor</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowUploadPoemFormatting((current) => !current)}
                          className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                            showUploadPoemFormatting
                              ? "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
                              : "border-line bg-white text-foreground/85 hover:border-violet-300 hover:text-violet-700"
                          }`}
                        >
                          {showUploadPoemFormatting ? "Hide format" : "Format"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUploadPoemPreview((current) => !current)}
                          className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                            showUploadPoemPreview
                              ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                              : "border-line bg-white text-foreground/85 hover:border-sky-300 hover:text-sky-700"
                          }`}
                        >
                          {showUploadPoemPreview ? "Hide preview" : "Preview"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPoemEditor("upload")}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line hover:border-foreground"
                          aria-label="Expand poem editor"
                          title="Expand poem editor"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M8 4H4v4" />
                            <path d="M16 4h4v4" />
                            <path d="M8 20H4v-4" />
                            <path d="M16 20h4v-4" />
                            <path d="M4 4l6 6" />
                            <path d="M20 4l-6 6" />
                            <path d="M4 20l6-6" />
                            <path d="M20 20l-6-6" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {showUploadPoemFormatting ? (
                      <div className="mt-2">
                        <PoemToolbar onInsert={insertPoemFormatting} />
                      </div>
                    ) : null}

                    <textarea
                      ref={uploadPoemRef}
                      name="poem"
                      value={uploadForm.poem}
                      onChange={(event) => {
                        handleUploadFieldChange(event);
                        resizeTextarea(event.target);
                      }}
                      rows={4}
                      className="mt-2 min-h-[120px] w-full border border-line px-3 py-2.5 leading-7 whitespace-pre-wrap outline-none focus:border-foreground"
                      disabled={isUploading}
                    />
                    {showUploadPoemPreview ? (
                      <PoemLivePreview
                        value={uploadForm.poem}
                        emptyText="Write a poem and click Preview to view formatting."
                        className="mt-2"
                      />
                    ) : null}
                  </div>
                </details>
              </div>
            </section>

            <section className="rounded-xl border border-foreground/20 bg-[linear-gradient(180deg,rgba(248,248,248,0.8)_0%,rgba(255,255,255,1)_100%)] p-4">
              <h3 className="text-lg font-semibold text-foreground">5. Upload</h3>
              <p className="mt-1 text-sm text-muted">
                Ready to upload {files.length} photo{files.length === 1 ? "" : "s"} with your current defaults.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {ready ? "Cloudinary is connected." : "Cloudinary is not configured."}
                </p>
                <button
                  type="submit"
                  className="w-full rounded-md border border-foreground bg-foreground px-6 py-3.5 text-sm font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[240px]"
                  disabled={isUploading || !ready || files.length === 0}
                >
                  {isUploading ? "Uploading..." : `Upload ${files.length || ""} photo${files.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </section>
          </form>

          {uploadMessage ? (
            <p className={`mt-4 text-sm ${uploadStatus === "error" ? "text-red-700" : "text-foreground/80"}`}>
              {uploadMessage}
            </p>
          ) : null}

          {uploadResults.length > 0 ? (
            <div className="mt-4 max-h-56 overflow-y-auto rounded-md border border-line bg-white">
              {uploadResults.map((item) => (
                <div
                  key={`${item.fileName}-${item.status}-${item.message}`}
                  className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0"
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

              <div className="space-y-4">
                <section className="h-fit rounded-2xl border border-line bg-white p-3 shadow-[0_12px_30px_rgba(0,0,0,0.05)] sm:p-4">
                  <h3 className="text-[11px] tracking-[0.14em] uppercase">Homepage Sequence</h3>
                  <p className="mt-2 text-sm text-muted">
                    Drag to reorder. Click Edit on a row to open the popup editor.
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Tip: drag photo cards from the Published Library Picker below into this sequence.
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
                    className="mt-3 max-h-[56vh] space-y-2 overflow-y-auto pr-1 sm:max-h-[62vh]"
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
                            className={`cursor-pointer rounded-xl border bg-white p-2.5 transition-all sm:p-3 ${
                              isActive
                                ? "border-foreground shadow-[0_10px_24px_rgba(0,0,0,0.09)]"
                                : isDropTarget
                                  ? "border-foreground/70 ring-1 ring-foreground/25"
                                  : "border-line hover:border-foreground/45"
                            } ${isDragging ? "scale-[0.995] opacity-60" : ""}`}
                          >
                            <div className="flex items-center gap-2.5 sm:gap-3">
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

                              <div className="relative h-[4.5rem] w-14 shrink-0 overflow-hidden rounded border border-line bg-zinc-200 sm:h-20 sm:w-16">
                                <Image
                                  src={photo.thumbnailUrl || photo.imageUrl}
                                  alt={photo.alt || photo.title || "Homepage photo"}
                                  fill
                                  sizes="(max-width: 640px) 72px, 96px"
                                  className="object-cover"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold leading-tight sm:text-base">
                                  {photo.title || "Untitled"}
                                </p>
                                <p className="mt-1 truncate text-[10px] tracking-[0.12em] text-muted uppercase">
                                  {photo.collection}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1">
                                {slotLabel === 1 ? (
                                  <span className="rounded-full border border-amber-500/70 bg-amber-50 px-1.5 py-0.5 text-[10px] tracking-[0.12em] text-amber-800 uppercase sm:px-2 sm:py-1">
                                    Main Photo
                                  </span>
                                ) : null}
                                {isDirty ? (
                                  <span className="rounded-full border border-amber-500/80 bg-amber-100 px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-amber-900 uppercase sm:px-2 sm:py-1">
                                    Unsaved
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-2 flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setHomepageActivePhotoId(photo.photoId);
                                  setIsHomepageEditorOpen(true);
                                }}
                                className="rounded border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                              >
                                Edit
                              </button>
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
              </div>

              <section className="rounded-2xl border border-line bg-white p-3 shadow-[0_12px_30px_rgba(0,0,0,0.05)] sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[11px] tracking-[0.14em] uppercase">Published Library Picker</h3>
                    <p className="mt-2 text-sm text-muted">
                      Add published photos to homepage. You can also drag a card directly into Homepage Sequence above.
                    </p>
                  </div>
                  <p className="text-xs tracking-[0.12em] text-muted uppercase">
                    {filteredHomepageAvailablePhotos.length} available
                  </p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {filteredHomepageAvailablePhotos.map((photo) => (
                    <article
                      key={photo.photoId}
                      draggable
                      onDragStart={(event) => handleHomepagePoolDragStart(event, photo.photoId)}
                      onDragEnd={handleHomepageDragEnd}
                      className="group overflow-hidden rounded-xl border border-line bg-white transition-all hover:border-foreground/45 hover:shadow-[0_10px_22px_rgba(0,0,0,0.08)]"
                    >
                      <div className="relative aspect-[4/5] w-full bg-zinc-200">
                        <Image
                          src={photo.thumbnailUrl || photo.imageUrl}
                          alt={photo.alt || photo.title || "Published photo"}
                          fill
                          sizes="(max-width: 640px) 88vw, (max-width: 1024px) 44vw, (max-width: 1536px) 30vw, 22vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="space-y-2 p-3 sm:p-3.5">
                        <p className="truncate text-[15px] font-semibold sm:text-base">{photo.title || "Untitled"}</p>
                        <p className="truncate text-[10px] tracking-[0.12em] text-muted uppercase">{photo.collection}</p>
                        <p className="hidden text-xs text-muted sm:block">Drag card to sequence, or use Add.</p>
                        <button
                          type="button"
                          onClick={() => addPhotoToHomepage(photo.photoId)}
                          disabled={homepagePhotoIds.length >= HOMEPAGE_MAX_PHOTOS}
                          className="w-full rounded border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground disabled:opacity-45"
                        >
                          Add to Homepage
                        </button>
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
          <div className="rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(252,249,244,0.96)_100%)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isDraftsTab ? "Draft Library" : "Photo Library"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-[10px] tracking-[0.12em] text-zinc-700 uppercase">
                  Sort: {currentLibrarySortLabel}
                </span>
                <span className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-[10px] tracking-[0.12em] text-zinc-700 uppercase">
                  Visibility: {currentLibraryVisibilityLabel}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid w-full gap-1 text-sm sm:w-[340px]">
                <span className="text-foreground/90">Search</span>
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Title, caption, poem"
                  className="w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                />
              </label>

              <label className="grid min-w-[190px] gap-1 text-sm">
                <span className="text-foreground/90">Category</span>
                <select
                  value={collectionFilter}
                  onChange={(event) => {
                    setPage(1);
                    setCollectionFilter(event.target.value);
                  }}
                  className={`border px-3 py-2.5 outline-none focus:border-foreground ${
                    isHomepageCollectionFilter
                      ? "border-emerald-300 bg-emerald-50/60 text-emerald-900"
                      : "border-line"
                  }`}
                >
                  <option value="All">All</option>
                  {!isDraftsTab ? (
                    <option value={HOMEPAGE_COLLECTION_FILTER}>Homepage</option>
                  ) : null}
                  {collectionOptions.map((collection) => (
                    <option key={collection} value={collection}>
                      {collection}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid min-w-[190px] gap-1 text-sm">
                <span className="text-foreground/90">Sort</span>
                <select
                  value={librarySort}
                  onChange={(event) => {
                    setPage(1);
                    setLibrarySort(event.target.value);
                  }}
                  className="border border-line px-3 py-2.5 outline-none focus:border-foreground"
                >
                  {librarySortOptions.map((option) => (
                    <option key={`top-sort-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div ref={libraryToolsRef} className="relative self-end">
                <button
                  type="button"
                  onClick={() => setShowLibraryToolsMenu((current) => !current)}
                  className="inline-flex h-[46px] items-center gap-2 rounded-md border border-line bg-white px-3 text-[12px] hover:border-foreground"
                  aria-expanded={showLibraryToolsMenu}
                  aria-label="Toggle library tools"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </svg>
                  Tools
                </button>

                {showLibraryToolsMenu ? (
                  <div className="absolute right-0 top-[calc(100%+0.55rem)] z-40 w-[min(94vw,430px)]">
                    <div className="relative rounded-xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(250,248,243,0.96)_100%)] p-4 shadow-[0_16px_44px_rgba(0,0,0,0.16)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">Library tools</p>
                        <button
                          type="button"
                          onClick={() => setShowLibraryToolsMenu(false)}
                          className="rounded-md border border-line px-2.5 py-1.5 text-xs hover:border-foreground"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-sm">
                          Visibility
                          <select
                            value={effectivePublishedFilter}
                            onChange={(event) => {
                              setPage(1);
                              setPublishedFilter(event.target.value);
                            }}
                            disabled={isDraftsTab}
                            className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                          >
                            <option value="all">All</option>
                            <option value="published">Published</option>
                            <option value="draft">Draft</option>
                          </select>
                        </label>

                        <label className="text-sm">
                          Per Page
                          <select
                            value={String(pageSize)}
                            onChange={(event) => {
                              setPage(1);
                              setPageSize(Number(event.target.value));
                            }}
                            className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                          >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        </label>

                      </div>

                      <div className="mt-3 rounded-md border border-line bg-white/90 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">Help</p>
                          <button
                            type="button"
                            onClick={() => setShowLibraryHelp((current) => !current)}
                            className="rounded-md border border-line px-2.5 py-1.5 text-xs hover:border-foreground"
                          >
                            {showLibraryHelp ? "Hide" : "Show"}
                          </button>
                        </div>
                        {showLibraryHelp ? (
                          <p className="mt-2 text-xs leading-5 text-foreground/80">
                            `Published` means visible on public pages. `Draft` stays private in admin only.
                            Use `Homepage` for main-page curation and sequence. Turn on `Reorder` mode to drag cards.
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-3 rounded-md border border-line bg-white/90 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">Categories</h3>
                          <p className="text-xs text-muted">Add, rename, or move category groups.</p>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCategoryToolMode("add")}
                            className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                              categoryToolMode === "add"
                                ? "border-foreground bg-foreground text-background"
                                : "border-line hover:border-foreground"
                            }`}
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryToolMode("rename")}
                            className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                              categoryToolMode === "rename"
                                ? "border-foreground bg-foreground text-background"
                                : "border-line hover:border-foreground"
                            }`}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setCategoryToolMode("move")}
                            className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                              categoryToolMode === "move"
                                ? "border-foreground bg-foreground text-background"
                                : "border-line hover:border-foreground"
                            }`}
                          >
                            Move
                          </button>
                        </div>

                        {categoryToolMode === "add" ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <input
                              value={newCollectionName}
                              onChange={(event) => setNewCollectionName(event.target.value)}
                              placeholder="New category name"
                              className="w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                            />
                            <button
                              type="button"
                              onClick={addCollectionOption}
                              className="rounded-md border border-line px-4 py-2.5 text-xs hover:border-foreground"
                            >
                              Add
                            </button>
                          </div>
                        ) : null}

                        {categoryToolMode === "rename" ? (
                          <div className="mt-2 grid gap-2">
                            <select
                              value={renameFromCollection}
                              onChange={(event) => setRenameFromCollection(event.target.value)}
                              className="w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                            >
                              <option value="">Select category</option>
                              {collectionOptions.map((collection) => (
                                <option key={`rename-${collection}`} value={collection}>
                                  {collection}
                                </option>
                              ))}
                            </select>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <input
                                value={renameToCollection}
                                onChange={(event) => setRenameToCollection(event.target.value)}
                                placeholder="New category name"
                                className="w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                              />
                              <button
                                type="button"
                                onClick={runRenameCollection}
                                disabled={isUpdatingCollections}
                                className="rounded-md border border-line px-4 py-2.5 text-xs hover:border-foreground disabled:opacity-45"
                              >
                                Rename
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {categoryToolMode === "move" ? (
                          <div className="mt-2 grid gap-2">
                            <select
                              value={moveFromCollection}
                              onChange={(event) => setMoveFromCollection(event.target.value)}
                              className="w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                            >
                              <option value="">From category</option>
                              {collectionOptions.map((collection) => (
                                <option key={`from-${collection}`} value={collection}>
                                  {collection}
                                </option>
                              ))}
                            </select>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <select
                                value={moveToCollection}
                                onChange={(event) => setMoveToCollection(event.target.value)}
                                className="w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
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
                                className="rounded-md border border-line px-4 py-2.5 text-xs hover:border-foreground disabled:opacity-45"
                              >
                                Move
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {isDraftsTab ? (
              <p className="mt-3 text-sm text-muted">
                Draft vault view: all unpublished photos are listed here so you can review and publish later.
              </p>
            ) : null}
          </div>

          {manageMessage ? (
            <p className={`text-sm ${manageStatus === "error" ? "text-red-700" : "text-muted"}`}>
              {manageMessage}
            </p>
          ) : null}

          <div className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={photos.length > 0 && selectedCount === photos.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 accent-foreground"
                    aria-label="Select all photos on this page"
                  />
                  Select all on page
                </label>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] uppercase ${libraryViewTone.chip}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${libraryViewTone.dot}`} aria-hidden="true" />
                    View: {currentLibraryViewLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-zinc-300 bg-zinc-50 px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] text-zinc-700 uppercase">
                    {selectedCount > 0 ? `${selectedCount} selected` : "Click card to edit"}
                  </span>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                {lastOrderSnapshot.length > 1 ? (
                  <button
                    type="button"
                    onClick={undoLastOrderChange}
                    disabled={isSavingOrder || loadingPhotos}
                    className="rounded-md border border-line px-3 py-2 text-xs disabled:opacity-50"
                  >
                    Undo last reorder
                  </button>
                ) : null}
                {isAutoSavingHomepageOrder ? (
                  <p className="text-sm text-muted">Saving homepage sequence...</p>
                ) : isSavingOrder ? (
                  <p className="text-sm text-muted">Saving order...</p>
                ) : (
                  <p className="text-sm text-muted">Drag photo thumbnails to reorder. Order saves automatically.</p>
                )}
              </div>

              {selectedCount > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50/80 p-2.5">
                  <label className="grid min-w-[190px] gap-1 text-xs">
                    <span className="text-foreground/85">Move selected to</span>
                    <select
                      value={bulkMoveCollection}
                      onChange={(event) => setBulkMoveCollection(event.target.value)}
                      className="border border-line px-2.5 py-2 outline-none focus:border-foreground"
                    >
                      {collectionOptions.map((collection) => (
                        <option key={`bulk-${collection}`} value={collection}>
                          {collection}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={runBulkMoveToCollection}
                    disabled={isBulkRunning}
                    className="rounded-md border border-line px-3 py-2 text-xs disabled:opacity-50"
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkPatch({ published: false }, "Selected photos moved to draft.")}
                    disabled={isBulkRunning}
                    className="rounded-md border border-line px-3 py-2 text-xs disabled:opacity-50"
                  >
                    Move to draft
                  </button>
                  <button
                    type="button"
                    onClick={runBulkDelete}
                    disabled={isBulkRunning}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-600 px-3 py-2 text-xs text-red-700 hover:bg-red-600 hover:text-white disabled:opacity-50"
                  >
                    <span className="h-3.5 w-3.5">
                      <TrashIcon />
                    </span>
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoIds([])}
                    className="rounded-md border border-line px-3 py-2 text-xs"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}

              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm text-muted">Click any photo card to edit in popup.</p>
              </div>
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
                            <div
                              draggable={canManualReorder}
                              onDragStart={(event) => {
                                if (!canManualReorder || isSavingOrder) {
                                  return;
                                }
                                event.stopPropagation();
                                handleCardDragStart(event, photo.photoId);
                              }}
                              onDragEnd={handleCardDragEnd}
                              className={`relative aspect-[4/5] w-full bg-zinc-200 ${canManualReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
                            >
                              <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex flex-wrap gap-1">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] ${
                                    photo.published === false
                                      ? "bg-rose-600/95 text-white"
                                      : "bg-sky-600/95 text-white"
                                  }`}
                                >
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
                            {canManualReorder ? (
                              <button
                                type="button"
                                draggable
                                onDragStart={(event) => {
                                  event.stopPropagation();
                                  handleCardDragStart(event, photo.photoId);
                                }}
                                onDragEnd={handleCardDragEnd}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.preventDefault()}
                                title="Drag card to reorder"
                                className="inline-flex cursor-grab items-center rounded p-1 text-muted/80 hover:bg-zinc-100 active:cursor-grabbing"
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
                              </button>
                            ) : <span className="h-4 w-4" aria-hidden="true" />}
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {!isHomepageCollectionFilter ? (
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
                  ) : null}
                </>
              )}
            </section>

            {isLibraryEditorOpen && activePhoto && activeDraft ? (
              <div
                className="fixed inset-0 z-50 bg-black/60 p-3 backdrop-blur-[2px] sm:p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    requestLibraryEditorClose();
                  }
                }}
              >
                <div className="mx-auto flex h-full max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(251,248,243,0.96)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
                  <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Library photo editor</p>
                      <p className="mt-1 truncate text-base text-foreground/90">
                        {activeDraft.title || activePhoto.title || "Untitled"}
                      </p>
                      <p className="mt-1 h-4 text-xs font-medium text-emerald-700/90">
                        {autoSavingPhotoId === activePhoto.photoId ? "Auto-saving changes..." : " "}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={restoreActivePhotoToOriginal}
                        disabled={
                          !canRestoreOriginal ||
                          autoSavingPhotoId === activePhoto.photoId ||
                          savingPhotoId === activePhoto.photoId ||
                          deletingPhotoId === activePhoto.photoId
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-foreground/30 text-foreground hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="Revert to original values"
                        title={canRestoreOriginal ? "Back to original values" : "No changes from original values"}
                      >
                        <span className="h-4 w-4">
                          <UndoIcon />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={requestLibraryEditorClose}
                        className="rounded-md border border-line px-3 py-2 text-xs hover:border-foreground"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div ref={editorPanelRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                      <aside className="space-y-3">
                        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md border border-line bg-zinc-200">
                          <Image
                            src={activePhoto.thumbnailUrl || activePhoto.imageUrl}
                            alt={activeDraft.alt || activeDraft.title || "Photo preview"}
                            fill
                            sizes="(max-width: 1024px) 100vw, 320px"
                            className="object-contain"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {activePhoto.featured && activePhoto.featuredOrder === 0 ? (
                            <span className="rounded bg-amber-500/90 px-2 py-0.5 text-xs text-black">Main photo</span>
                          ) : activePhoto.featured ? (
                            <span className="rounded bg-emerald-600/90 px-2 py-0.5 text-xs text-white">On homepage</span>
                          ) : (
                            <span className="rounded border border-line px-2 py-0.5 text-xs text-muted">Not on homepage</span>
                          )}
                          <span
                            className={`rounded px-2 py-0.5 text-xs ${
                              activeDraft.published
                                ? "bg-sky-600/95 text-white"
                                : "bg-rose-600/95 text-white"
                            }`}
                          >
                            {activeDraft.published ? "Published" : "Draft"}
                          </span>
                        </div>
                      </aside>

                      <div className="space-y-4">
                        <section className="rounded-md border border-line bg-white p-3">
                          <h3 className="text-base font-semibold">Basic info</h3>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label>
                              Title
                              <input
                                value={activeDraft.title}
                                onChange={(event) => handleDraftChange(activePhoto.photoId, "title", event.target.value)}
                                className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                                disabled={Boolean(savingPhotoId || deletingPhotoId)}
                              />
                            </label>

                            <label>
                              Alt text
                              <input
                                value={activeDraft.alt}
                                onChange={(event) => handleDraftChange(activePhoto.photoId, "alt", event.target.value)}
                                className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                                disabled={Boolean(savingPhotoId || deletingPhotoId)}
                              />
                            </label>
                          </div>
                          <label className="mt-3 block">
                            Collection
                            <select
                              value={activeDraft.collection}
                              onChange={(event) => handleDraftChange(activePhoto.photoId, "collection", event.target.value)}
                              className="mt-1.5 w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            >
                              {collectionOptions.map((collection) => (
                                <option key={collection} value={collection}>
                                  {collection}
                                </option>
                              ))}
                            </select>
                          </label>
                        </section>

                        <section className="rounded-md border border-line bg-white p-3">
                          <h3 className="text-base font-semibold">Publishing</h3>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <ToggleSwitch
                              label="On homepage"
                              checked={Boolean(activeDraft.featured)}
                              tone="homepage"
                              onChange={(event) =>
                                handleDraftChange(activePhoto.photoId, "featured", event.target.checked)
                              }
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            />
                            <ToggleSwitch
                              label="Published"
                              checked={Boolean(activeDraft.published)}
                              tone="published"
                              onChange={(event) =>
                                handleDraftChange(activePhoto.photoId, "published", event.target.checked)
                              }
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            />
                          </div>
                          <p className="mt-2 text-sm text-muted">
                            Published photos appear on public pages. Unpublished photos stay private in Drafts.
                          </p>
                        </section>

                        <section className="rounded-md border border-line bg-white p-3">
                          <h3 className="text-base font-semibold">Content</h3>
                          <label className="mt-3 block">
                            Caption
                            <textarea
                              rows={4}
                              value={activeDraft.caption}
                              onChange={(event) => {
                                handleDraftChange(activePhoto.photoId, "caption", event.target.value);
                                resizeTextarea(event.target);
                              }}
                              className="mt-1.5 min-h-[120px] w-full border border-line px-3 py-2.5 outline-none focus:border-foreground"
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            />
                          </label>

                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold">Poem</p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowLibraryPoemFormatting((current) => !current)}
                                  className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                                    showLibraryPoemFormatting
                                      ? "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100"
                                      : "border-line bg-white text-foreground/85 hover:border-violet-300 hover:text-violet-700"
                                  }`}
                                >
                                  {showLibraryPoemFormatting ? "Hide format" : "Format"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowLibraryPoemPreview((current) => !current)}
                                  className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                                    showLibraryPoemPreview
                                      ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                                      : "border-line bg-white text-foreground/85 hover:border-sky-300 hover:text-sky-700"
                                  }`}
                                >
                                  {showLibraryPoemPreview ? "Hide preview" : "Preview"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openPoemEditor("photo", activePhoto.photoId)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line hover:border-foreground"
                                  aria-label="Expand poem editor"
                                  title="Expand poem editor"
                                >
                                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path d="M8 4H4v4" />
                                    <path d="M16 4h4v4" />
                                    <path d="M8 20H4v-4" />
                                    <path d="M16 20h4v-4" />
                                    <path d="M4 4l6 6" />
                                    <path d="M20 4l-6 6" />
                                    <path d="M4 20l6-6" />
                                    <path d="M20 20l-6-6" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {showLibraryPoemFormatting ? (
                              <div className="mt-2">
                                <PoemToolbar onInsert={insertPoemFormatting} />
                              </div>
                            ) : null}
                            <textarea
                              ref={editorPoemRef}
                              rows={6}
                              value={activeDraft.poem}
                              onChange={(event) => {
                                handleDraftChange(activePhoto.photoId, "poem", event.target.value);
                                resizeTextarea(event.target);
                              }}
                              className="mt-1.5 min-h-[160px] w-full border border-line px-3 py-2.5 leading-7 whitespace-pre-wrap outline-none focus:border-foreground"
                              disabled={Boolean(savingPhotoId || deletingPhotoId)}
                            />
                            {showLibraryPoemPreview ? (
                              <PoemLivePreview
                                value={activeDraft.poem}
                                emptyText="Write text and click Preview to render italics/emphasis."
                                className="mt-2"
                              />
                            ) : null}
                          </div>
                        </section>

                        <section className="rounded-md border border-red-200 bg-red-50/60 p-3">
                          <h3 className="text-sm font-semibold text-red-800">Danger zone</h3>
                          <p className="mt-1 text-sm text-red-700">Delete permanently from library and cloud storage.</p>
                          <button
                            type="button"
                            onClick={() => deletePhoto(activePhoto)}
                            disabled={savingPhotoId === activePhoto.photoId || deletingPhotoId === activePhoto.photoId}
                            className="mt-3 rounded-md border border-red-600 px-4 py-2 text-xs text-red-700 hover:bg-red-600 hover:text-white disabled:opacity-50"
                          >
                            {deletingPhotoId === activePhoto.photoId ? "Deleting..." : "Delete photo"}
                          </button>
                        </section>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          </>
          )}
        </section>
      )}

      {isHomepageEditorOpen && homepageActivePhoto && homepageActiveDraft ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 p-3 backdrop-blur-[2px] sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsHomepageEditorOpen(false);
            }
          }}
        >
          <div className="relative mx-auto flex h-full max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,240,0.95)_100%)] shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
            <span className="pointer-events-none absolute -top-5 left-10 h-10 w-10 rounded-full bg-white/95 shadow-[0_8px_16px_rgba(0,0,0,0.12)]" />
            <span className="pointer-events-none absolute -top-8 left-20 h-12 w-12 rounded-full bg-white/95 shadow-[0_8px_16px_rgba(0,0,0,0.12)]" />

            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] tracking-[0.12em] text-muted uppercase">Homepage Photo Editor</p>
                <p className="mt-1 truncate text-base font-semibold sm:text-lg">
                  {homepageActiveDraft.title || homepageActivePhoto.title || "Untitled"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHomepageEditorOpen(false)}
                className="rounded border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <div className="relative h-52 w-full overflow-hidden rounded border border-line bg-zinc-200 sm:h-64 lg:h-72">
                    <Image
                      src={homepageActivePhoto.thumbnailUrl || homepageActivePhoto.imageUrl}
                      alt={homepageActiveDraft.alt || homepageActiveDraft.title || "Homepage photo preview"}
                      fill
                      sizes="(max-width: 1024px) 100vw, 240px"
                      className="object-cover"
                    />
                  </div>
                  <p className="text-xs text-muted">
                    Position #
                    {Math.max(1, homepagePhotoIds.findIndex((id) => id === homepageActivePhoto.photoId) + 1)}
                  </p>
                  {homepagePhotoIds[0] === homepageActivePhoto.photoId ? (
                    <span className="inline-flex rounded-full bg-amber-500/90 px-2 py-1 text-[10px] tracking-[0.12em] text-black uppercase">
                      Main Photo
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-emerald-600/90 px-2 py-1 text-[10px] tracking-[0.12em] text-white uppercase">
                      On Homepage
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] tracking-[0.12em] uppercase">
                    Title
                    <input
                      value={homepageActiveDraft.title}
                      onChange={(event) =>
                        handleDraftChange(homepageActivePhoto.photoId, "title", event.target.value)
                      }
                      className="mt-1.5 w-full border border-line px-3 py-2 text-sm font-medium normal-case outline-none focus:border-foreground"
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
                        <option key={`homepage-modal-${collection}`} value={collection}>
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
                            setIsHomepageEditorOpen(false);
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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowHomepagePoemPreview((current) => !current)}
                          className={`border px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors ${
                            showHomepagePoemPreview
                              ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                              : "border-line bg-white text-foreground/85 hover:border-sky-300 hover:text-sky-700"
                          }`}
                        >
                          {showHomepagePoemPreview ? "Hide Preview" : "Preview"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPoemEditor("photo", homepageActivePhoto.photoId)}
                          className="border border-line px-2 py-1 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                        >
                          Expand Editor
                        </button>
                      </div>
                    </div>
                    <PoemToolbar onInsert={insertHomepagePoemFormatting} />
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
                    {showHomepagePoemPreview ? (
                      <PoemLivePreview
                        value={homepageActiveDraft.poem}
                        emptyText="Write text and click Preview to render italics/emphasis."
                        className="mt-2"
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => savePhoto(homepageActivePhoto.photoId)}
                      disabled={
                        savingPhotoId === homepageActivePhoto.photoId ||
                        deletingPhotoId === homepageActivePhoto.photoId
                      }
                      className="border border-foreground bg-foreground px-4 py-2 text-[10px] tracking-[0.14em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {savingPhotoId === homepageActivePhoto.photoId ? "Saving..." : "Save"}
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
                      onClick={() => {
                        removePhotoFromHomepage(homepageActivePhoto.photoId);
                        setIsHomepageEditorOpen(false);
                      }}
                      className="border border-line px-4 py-2 text-[10px] tracking-[0.14em] uppercase transition-colors hover:border-foreground"
                    >
                      Remove From Homepage
                    </button>
                    {homepageActiveIsDirty ? (
                      <p className="self-center text-xs text-amber-700">Unsaved changes</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reorderConfirmPrompt.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm reorder change"
            className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.25)]"
          >
            <h3 className="text-base font-semibold">Apply new order?</h3>
            <p className="mt-3 text-sm leading-6 text-foreground/80">
              You are viewing <strong>{reorderConfirmPrompt.sortLabel}</strong>. Reordering now will save a new manual order for this view.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelReorderConfirm}
                className="rounded-md border border-line px-3 py-2 text-xs hover:border-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReorderChange}
                disabled={isSavingOrder}
                className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs text-background disabled:opacity-50"
              >
                {isSavingOrder ? "Applying..." : "Apply reorder"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      {libraryExitPrompt.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved photo edits before closing modal"
            className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-[0_18px_54px_rgba(0,0,0,0.25)]"
          >
            <h3 className="text-sm tracking-[0.14em] uppercase">Unsaved Edits</h3>
            <p className="mt-3 text-sm leading-6 text-foreground/80">
              You have unsaved edits on this photo. Save before closing the editor?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelLibraryExitPrompt}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={discardAndCloseLibraryEditor}
                className="border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
              >
                Exit Without Saving
              </button>
              <button
                type="button"
                onClick={saveAndCloseLibraryEditor}
                disabled={Boolean(savingPhotoId)}
                className="border border-foreground bg-foreground px-3 py-2 text-[10px] tracking-[0.12em] text-background uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {savingPhotoId ? "Saving..." : "Save & Exit"}
              </button>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowModalPoemPreview((current) => !current)}
                  className={`rounded border px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors ${
                    showModalPoemPreview
                      ? "border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100"
                      : "border-line bg-white text-foreground/85 hover:border-sky-300 hover:text-sky-700"
                  }`}
                >
                  {showModalPoemPreview ? "Hide Preview" : "Preview"}
                </button>
                <button
                  type="button"
                  onClick={closePoemEditor}
                  className="rounded border border-line px-3 py-2 text-[10px] tracking-[0.12em] uppercase transition-colors hover:border-foreground"
                >
                  Close
                </button>
              </div>
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

              {showModalPoemPreview ? (
                <PoemLivePreview
                  value={modalPoemValue}
                  emptyText="Write text and click Preview to render italics/emphasis."
                  className="mt-4"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
