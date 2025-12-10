import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

interface UsePaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const { defaultPage = 1, defaultLimit = 50 } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? parseInt(pageParam, 10) : defaultPage;
  });
  const [limit, setLimit] = useState(() => {
    const limitParam = searchParams.get("limit");
    return limitParam ? parseInt(limitParam, 10) : defaultLimit;
  });

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", String(page));
    newParams.set("limit", String(limit));
    setSearchParams(newParams, { replace: true });
  }, [page, limit, searchParams, setSearchParams]);

  const goToPage = (newPage: number) => {
    setPage(newPage);
  };

  const changeLimit = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page when changing limit
  };

  return {
    page,
    limit,
    goToPage,
    changeLimit,
  };
}

