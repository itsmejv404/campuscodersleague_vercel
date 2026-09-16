"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Award,
  Download,
  FileSpreadsheet,
  Search,
  ArrowLeft,
  RefreshCw,
  Vote,
  Users,
  ArrowUpDown,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Eye,
  ExternalLink,
  Percent,
} from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: "CS" | "NonCS";
  studentId: string;
}

interface SubmissionInfo {
  id: string;
  pdfUrl: string;
  fileName: string;
  fileSize: number;
  submitterName: string;
  submitterEmail: string;
  submitterStudentId: string | null;
  submittedAt: string;
  submissionCount: number;
}

interface ResultRow {
  rank: number;
  teamId: string;
  teamName: string;
  voteCount: number;
  votePercentage: number;
  votePercentageDisplay: string;
  isSubmitted: boolean;
  submission: SubmissionInfo | null;
  submittedByText: string;
  members: Member[];
}

export default function AdminResultsPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"votes" | "name">("votes");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // PDF Preview Modal State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState<string>("");

  // Reset polling modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTeams, setResetTeams] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadResults = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/results");
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      }
      if (typeof data.totalVotes === "number") {
        setTotalVotes(data.totalVotes);
      }
    } catch {
      console.error("Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const handleResetPolling = async () => {
    setResetting(true);
    setResetFeedback(null);
    try {
      const res = await fetch("/api/admin/reset-polling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetTeams }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResetFeedback({ type: "error", text: data.error || "Failed to reset polling." });
      } else {
        setResetFeedback({
          type: "success",
          text: data.message || "Polling votes have been successfully reset to 0!",
        });
        setShowResetModal(false);
        loadResults();
      }
    } catch {
      setResetFeedback({ type: "error", text: "Network error while resetting polling." });
    } finally {
      setResetting(false);
    }
  };

  const toggleSort = (field: "votes" | "name") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder(field === "votes" ? "desc" : "asc");
    }
  };

  const filteredAndSorted = results
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.teamName.toLowerCase().includes(q) ||
        (r.submission?.submitterName && r.submission.submitterName.toLowerCase().includes(q)) ||
        r.members.some(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            m.studentId.toLowerCase().includes(q)
        )
      );
    })
    .sort((a, b) => {
      if (sortBy === "votes") {
        return sortOrder === "desc"
          ? b.voteCount - a.voteCount
          : a.voteCount - b.voteCount;
      } else {
        return sortOrder === "desc"
          ? b.teamName.localeCompare(a.teamName)
          : a.teamName.localeCompare(b.teamName);
      }
    });

  return (
    <div className="space-y-8 py-6">
      {/* Navigation */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center text-xs font-medium text-gray-500 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Admin Hub
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Leaderboard & Live Results
            </h1>
            <p className="text-xs text-gray-500">
              Live tally of all votes and calculated vote percentages (%) with proof of work verification and spreadsheet exports.
            </p>
          </div>
        </div>

        {/* Action & Export Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Reset Polling Button */}
          <button
            onClick={() => {
              setResetFeedback(null);
              setShowResetModal(true);
            }}
            className="inline-flex items-center px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition shadow-xs"
            title="Clear all cast votes"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-red-600" />
            Reset Polling
          </button>

          <a
            href="/api/admin/results?format=csv"
            download="campus-coders-league-results.csv"
            className="inline-flex items-center px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
            Export CSV
          </a>

          <a
            href="/api/admin/results?format=xlsx"
            download="campus-coders-league-results.xlsx"
            className="inline-flex items-center px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
            Export Excel (.xlsx)
          </a>
        </div>
      </div>

      {/* Feedback Banner */}
      {resetFeedback && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between text-xs sm:text-sm ${
            resetFeedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center space-x-2">
            {resetFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{resetFeedback.text}</span>
          </div>
          <button
            onClick={() => setResetFeedback(null)}
            className="text-xs font-medium underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Sort Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by team, student, or submitter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <span>
              Total Teams: <strong>{results.length}</strong>
            </span>
            <span>
              Total Votes Cast: <strong className="text-indigo-600">{totalVotes}</strong>
            </span>
            <button
              onClick={loadResults}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition"
              title="Refresh results"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 w-12 text-center">S.No</th>
                <th
                  onClick={() => toggleSort("name")}
                  className="px-4 py-3 cursor-pointer hover:text-gray-900 select-none"
                >
                  <div className="flex items-center space-x-1">
                    <span>Team Name</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("votes")}
                  className="px-4 py-3 cursor-pointer hover:text-gray-900 select-none text-right"
                >
                  <div className="flex items-center justify-end space-x-1">
                    <span>Votes & Share</span>
                    <ArrowUpDown className="w-3 h-3 text-gray-400" />
                  </div>
                </th>
                <th className="px-4 py-3">Proof of Work (PDF)</th>
                <th className="px-4 py-3">Student 1</th>
                <th className="px-4 py-3">Student 2</th>
                <th className="px-4 py-3">Student 3</th>
                <th className="px-4 py-3">Student 4</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <RefreshCw className="w-4 h-4 mx-auto animate-spin mb-1 text-gray-300" />
                    Loading leaderboard standings...
                  </td>
                </tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No teams found matching search.
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((team, idx) => {
                  const sub = team.submission;

                  return (
                    <tr key={team.teamId} className="hover:bg-gray-50/75 transition">
                      <td className="px-3 py-3.5 text-center font-bold text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                        {team.teamName}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-indigo-700 text-sm bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">
                            {team.voteCount} votes
                          </span>
                          <span className="text-[11px] font-semibold text-gray-500 mt-0.5">
                            {team.votePercentageDisplay}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {sub ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => {
                                  setPreviewPdfUrl(sub.pdfUrl);
                                  setPreviewPdfTitle(team.teamName);
                                }}
                                className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold border border-indigo-100 transition"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View PDF
                              </button>
                              <a
                                href={sub.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-0.5 text-gray-400 hover:text-gray-600"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <div className="text-[10px] text-gray-500 truncate max-w-[170px]" title={sub.submitterName}>
                              By: <strong>{sub.submitterName}</strong>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300 italic text-[11px]">No Submission</span>
                        )}
                      </td>
                      {[0, 1, 2, 3].map((slot) => {
                        const m = team.members[slot];
                        return (
                          <td key={slot} className="px-4 py-3.5 whitespace-nowrap">
                            {m ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-semibold text-gray-900">{m.name}</span>
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                                      m.category === "CS"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-purple-100 text-purple-800"
                                    }`}
                                  >
                                    {m.category === "CS" ? "CS" : "Core"}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-400">
                                  {m.email} {m.phone ? `• ${m.phone}` : ""}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300 italic">Unassigned</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-bold truncate">
                  Proof of Work — {previewPdfTitle}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded text-gray-200 transition"
                >
                  Open in New Tab
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="p-1 text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 p-1">
              <iframe
                src={previewPdfUrl}
                className="w-full h-full rounded border-0"
                title="Proof of Work PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Reset Polling */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-gray-900">Reset Polling Votes</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to reset polling? All cast vote records will be permanently deleted and all team vote tallies will be set back to <strong>0</strong>.
            </p>

            {/* Optional checkbox to also reset teams */}
            <div className="pt-2 border-t border-gray-100">
              <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={resetTeams}
                  onChange={(e) => setResetTeams(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <strong>Also wipe teams:</strong> Disband all teams and return all participants to the unassigned pool.
                </span>
              </label>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetPolling}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition"
              >
                {resetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Confirm & Reset"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
