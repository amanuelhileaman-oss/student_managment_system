import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';

const DataTable = ({
  columns,
  data = [],
  searchPlaceholder = 'Search records...',
  searchKey,
  itemsPerPage = 10,
  emptyMessage = 'No records found.',
  actionButton,
  extraFilters,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = data.filter((item) => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase().trim();
    if (!query) return true;

    if (searchKey && item[searchKey]) {
      return String(item[searchKey]).toLowerCase().includes(query);
    }

    const tokens = query.split(/\s+/).filter(Boolean);

    // Build comprehensive searchable corpus for this record
    const values = [];
    for (const val of Object.values(item)) {
      if (val !== null && val !== undefined) {
        values.push(String(val).toLowerCase());
      }
    }

    // Full name
    if (item.first_name || item.last_name) {
      values.push(`${item.first_name || ''} ${item.last_name || ''}`.toLowerCase());
      values.push(`${item.last_name || ''} ${item.first_name || ''}`.toLowerCase());
    }

    // Grade variations (e.g. current_grade_level or grade_level)
    const grade = item.current_grade_level || item.grade_level;
    if (grade) {
      values.push(`grade ${grade}`.toLowerCase());
      values.push(`g${grade}`.toLowerCase());
      values.push(`gr ${grade}`.toLowerCase());
      values.push(`grade${grade}`.toLowerCase());
    }

    // Section variations (e.g. section_name)
    const sec = item.section_name;
    if (sec) {
      values.push(`section ${sec}`.toLowerCase());
      values.push(`sec ${sec}`.toLowerCase());
      values.push(`section-${sec}`.toLowerCase());
      if (grade) {
        values.push(`grade ${grade} section ${sec}`.toLowerCase());
        values.push(`grade ${grade} - ${sec}`.toLowerCase());
        values.push(`grade ${grade}-${sec}`.toLowerCase());
        values.push(`${grade}-${sec}`.toLowerCase());
        values.push(`${grade}${sec}`.toLowerCase());
        values.push(`grade ${grade} ${sec}`.toLowerCase());
      }
    }

    // Stream
    if (item.stream_name) values.push(String(item.stream_name).toLowerCase());
    if (item.stream_code) values.push(String(item.stream_code).toLowerCase());

    // Role, identifier, specialization
    if (item.role) values.push(String(item.role).toLowerCase());
    if (item.student_id) values.push(String(item.student_id).toLowerCase());
    if (item.teacher_id) values.push(String(item.teacher_id).toLowerCase());
    if (item.specialization) values.push(String(item.specialization).toLowerCase());
    if (item.qualification) values.push(String(item.qualification).toLowerCase());

    const combinedSearchText = values.join(' ');

    // Match all tokens
    return tokens.every((token) => combinedSearchText.includes(token));
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const handleClear = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Header controls */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searchTerm && (
            <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0 font-medium">
              Found <span className="font-bold text-primary-600 dark:text-primary-400">{filteredData.length}</span> matching records
            </div>
          )}

          {extraFilters && <div className="flex items-center gap-2 flex-wrap">{extraFilters}</div>}
        </div>

        {actionButton && <div className="shrink-0">{actionButton}</div>}
      </div>

      {/* Table container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {columns.map((col, idx) => (
                <th key={idx} className={`py-3.5 px-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className={`py-3 px-4 ${col.className || ''}`}>
                      {col.render
                        ? col.render(row, rowIdx)
                        : col.cell
                        ? col.cell(row, rowIdx)
                        : (row[col.accessor || col.accessorKey] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-medium">
              {Math.min(startIndex + itemsPerPage, filteredData.length)}
            </span>{' '}
            of <span className="font-medium">{filteredData.length}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
