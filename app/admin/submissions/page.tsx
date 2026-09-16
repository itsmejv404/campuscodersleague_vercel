"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileText,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Download,
  Search,
  ExternalLink,
  ShieldCheck,
  Eye,
  X,
  FileCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface SubmissionData {
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

interface TeamWithSubmission {
  id: string;
  name: string;
  createdAt: string;
  members: Array<{
    id: string;
    name: string;
    studentId: string;
    category: "CS" | "NonCS";
  }>;
  submission: SubmissionData | null;
  voteCount: number;
}

export default function AdminSubmissionsPage() {
  const [teams, setTeams] = useState<TeamWithSubmission[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [windowStatus, setWindowStatus] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [savingWindow, setSavingWindow] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [winRes, teamsRes] = await Promise.all([
        fetch("/api/admin/submission-window"),
        fetch("/api/teams"),
      ]);

      const winData = await winRes.json();
      const teamsData = await teamsRes.json();

      setIsOpen(winData.isOpen ?? true);
      setWindowStatus(winData.status || "open");

      if (teamsData.teams) {
        setTeams(teamsData.teams);
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to load submissions data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSubmissions = async () => {
    const nextState = !isOpen;
    setSavingWindow(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/submission-window", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: nextState, isActive: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update submissions status." });
      } else {
        setIsOpen(nextState);
        setWindowStatus(nextState ? "open" : "closed");
        setFeedback({
          type: "success",
          text: nextState
            ? "Submissions have been opened! Teams can now submit and revise Proof of Work PDFs."
            : "Submissions have been closed! New uploads and revisions are now blocked.",
        });
      }
    } catch {
      setFeedback({ type: "error", text: "Network error updating submission status." });
    } finally {
      setSavingWindow(false);
    }
  };

  const totalTeams = teams.length;
  const submittedTeams = teams.filter((t) => t.submission !== null).length;
  const pendingTeams = totalTeams - submittedTeams;

  const filteredTeams = teams.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.members.some((m) => m.name.toLowerCase().includes(q)) ||
      (t.submission?.submitterName && t.submission.submitterName.toLowerCase().includes(q)) ||
      (t.submission?.submitterEmail && t.submission.submitterEmail.toLowerCase().includes(q))
    );
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

      {/* Header with Open/Close Toggle */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Proof of Work Submissions
            </h1>
            <p className="text-xs text-gray-500">
              Control submission window status, monitor submitted team PDFs, and inspect submitter details.
            </p>
          </div>
        </div>

        {/* Action Toggle Switch */}
        <div className="flex items-center space-x-4 bg-gray-50 border border-gray-200 px-5 py-3 rounded-xl">
          <div className="text-left">
            <div className="text-xs font-semibold text-gray-900">
              Submissions Status:{" "}
              {isOpen ? (
                <span className="text-emerald-600 font-bold">OPEN</span>
              ) : (
                <span className="text-red-600 font-bold">CLOSED</span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              {isOpen ? "Teams can upload & update PDFs" : "All uploads disabled"}
            </p>
          </div>

          <button
            onClick={handleToggleSubmissions}
            disabled={savingWindow}
            className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold transition shadow-xs disabled:opacity-50 ${
              isOpen
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {savingWindow ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Updating...
              </>
            ) : isOpen ? (
              "Close Submissions"
            ) : (
              "Open Submissions"
            )}
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between text-xs sm:text-sm ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-medium underline ml-4 hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Total Teams Formed
          </span>
          <div className="mt-2 text-2xl font-bold text-gray-900">{totalTeams}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Registered participating squads</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Submissions Received
          </span>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{submittedTeams}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {totalTeams > 0 ? `${Math.round((submittedTeams / totalTeams) * 100)}% completion rate` : "0%"}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Submissions Pending
          </span>
          <div className="mt-2 text-2xl font-bold text-amber-600">{pendingTeams}</div>
          <p className="text-[11px] text-gray-400 mt-0.5">Teams awaiting PDF upload</p>
        </div>
      </div>

      {/* Submissions Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by team, member, or submitter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center space-x-3 text-xs text-gray-600">
            <span>
              Showing <strong>{filteredTeams.length}</strong> teams
            </span>
            <button
              onClick={loadData}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded transition"
              title="Refresh submissions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 w-12 text-center">S.No</th>
                <th className="px-4 py-3">Team Name</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-4 py-3">Proof of Work (PDF)</th>
                <th className="px-4 py-3">Submitted By</th>
                <th className="px-3 py-3 text-center">Revisions</th>
                <th className="px-4 py-3">Submitted At</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <RefreshCw className="w-4 h-4 mx-auto animate-spin mb-1 text-gray-300" />
                    Loading team submissions...
                  </td>
                </tr>
              ) : filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No teams found matching search.
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team, idx) => {
                  const sub = team.submission;

                  return (
                    <tr key={team.id} className="hover:bg-gray-50/75 transition">
                      <td className="px-3 py-3.5 text-center font-bold text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                        <div>{team.name}</div>
                        <div className="text-[11px] font-normal text-gray-400">
                          {team.members.length} members ({team.members.map((m) => m.name).join(", ")})
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {sub ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" />
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 mr-1 text-amber-500" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {sub ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedPdfUrl(sub.pdfUrl);
                                setSelectedPdfTitle(team.name);
                              }}
                              className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition border border-indigo-100"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View PDF
                            </button>
                            <a
                              href={sub.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-gray-400 hover:text-gray-700 transition"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">No file uploaded</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {sub ? (
                          <div>
                            <div className="font-semibold text-gray-900">{sub.submitterName}</div>
                            <div className="text-[11px] text-gray-500">
                              {sub.submitterEmail} {sub.submitterStudentId ? `• ${sub.submitterStudentId}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300 italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center whitespace-nowrap font-medium text-gray-600">
                        {sub ? (
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                            #{sub.submissionCount}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-[11px] text-gray-500">
                        {sub ? formatDate(sub.submittedAt) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {selectedPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-bold truncate">
                  Proof of Work — {selectedPdfTitle}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={selectedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded text-gray-200 transition"
                >
                  Open in New Tab
                </a>
                <button
                  onClick={() => setSelectedPdfUrl(null)}
                  className="p-1 text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 p-1">
              <iframe
                src={selectedPdfUrl}
                className="w-full h-full rounded border-0"
                title="Proof of Work PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
