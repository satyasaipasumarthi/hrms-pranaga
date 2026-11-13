import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE_SUGGESTIONS = [10, 20, 30, 40, 50];
const MAX_PAGE_SIZE = 1000;

export const usePagination = <T,>(
  items: T[],
  initialPageSize = PAGE_SIZE_SUGGESTIONS[0],
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [items, pageSize]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  return {
    currentPage,
    pageSize,
    setPageSize,
    totalPages,
    pageItems,
    pageStart: items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1,
    pageEnd: Math.min(currentPage * pageSize, items.length),
    goToPreviousPage: () => setCurrentPage((page) => Math.max(1, page - 1)),
    goToNextPage: () =>
      setCurrentPage((page) => Math.min(totalPages, page + 1)),
  };
};

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageStart: number;
  pageEnd: number;
  totalItems: number;
  itemLabel?: string;
  onPageSizeChange: (size: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

const PaginationControls = ({
  currentPage,
  totalPages,
  pageSize,
  pageStart,
  pageEnd,
  totalItems,
  itemLabel = "employees",
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
}: PaginationControlsProps) => {
  const [draft, setDraft] = useState(String(pageSize));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isMenuOpen]);

  useEffect(() => {
    setDraft(String(pageSize));
  }, [pageSize]);

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setDraft(digits);

    const parsed = Number(digits);
    if (parsed >= 1 && parsed <= MAX_PAGE_SIZE) {
      onPageSizeChange(parsed);
    }
  };

  return (
    <div className="w-full flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-black">
      {/* 1. Left: Rows per page */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-black">Rows per page</span>
        <div ref={menuRef} className="relative inline-flex items-center">
          <div className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white shadow-sm overflow-hidden focus-within:border-[#3B82F6]">
            <input
              type="text"
              inputMode="numeric"
              value={draft}
              onChange={(event) => handleChange(event.target.value)}
              onBlur={() => setDraft(String(pageSize))}
              aria-label="Rows per page"
              className="w-9 border-none bg-transparent py-1 text-center text-xs font-semibold text-black focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label="Show page size options"
              aria-expanded={isMenuOpen}
              className="flex h-full items-center border-l border-slate-200 px-1.5 text-slate-600 hover:text-black focus:outline-none"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {isMenuOpen && (
            <ul className="absolute bottom-full left-0 z-50 mb-1 min-w-[56px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {PAGE_SIZE_SUGGESTIONS.map((size) => (
                <li key={size}>
                  <button
                    type="button"
                    onClick={() => {
                      onPageSizeChange(size);
                      setIsMenuOpen(false);
                    }}
                    className={`block w-full px-2.5 py-1 text-center text-xs font-medium transition-colors hover:bg-[#DBEAFE] hover:text-[#3B82F6] ${
                      size === pageSize
                        ? "bg-[#DBEAFE] text-[#3B82F6] font-bold"
                        : "text-black"
                    }`}
                  >
                    {size}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 2. Center: Prev / Page 1 of 1 / Next */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPreviousPage}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-black shadow-sm transition-colors hover:border-[#3B82F6] hover:bg-[#DBEAFE] hover:text-[#3B82F6] disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-black"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-xs font-medium text-black">
          Page <span className="font-bold">{currentPage}</span> of{" "}
          <span className="font-bold">{totalPages}</span>
        </p>

        <button
          type="button"
          onClick={onNextPage}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-black shadow-sm transition-colors hover:border-[#3B82F6] hover:bg-[#DBEAFE] hover:text-[#3B82F6] disabled:cursor-not-allowed disabled:border-slate-200 disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-black"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 3. Right: Showing X-Y of Z */}
      <p className="text-xs font-medium text-black">
        Showing <span className="font-semibold">{pageStart}</span>-
        <span className="font-semibold">{pageEnd}</span> of{" "}
        <span className="font-semibold">{totalItems}</span> {itemLabel}
      </p>
    </div>
  );
};

export default PaginationControls;
