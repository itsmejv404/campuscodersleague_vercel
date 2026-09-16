"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Vote as VoteIcon,
  CheckCircle2,
  Clock,
  Search,
  Users,
  AlertCircle,
  RefreshCw,
  Sparkles,
  FileText,
  Eye,
  ExternalLink,
  X,
  FileCheck,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  category: "CS" | "NonCS";
  studentId: string;
}

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

interface TeamCardData {
  id: string;
  name: string;
  createdByParticipantId: string;
  createdAt: string;
  members: Member[];
  submission: SubmissionData | null;
  voteCount: number;
}

interface VotingWindow {
  id: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export default function VotePage() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<TeamCardData[]>([]);
  const [votedTeamIds, setVotedTeamIds] = useState<Set<string>>(new Set());
  const [windowData, setWindowData] = useState<VotingWindow | null>(null);
  const [windowStatus, setWindowStatus] = useState<string>("loading");
  const [searchQuery, setSearchQuery] = useState("");
  const [votingOnId, setVotingOnId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // PDF Preview modal state
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingTeamName, setViewingTeamName] = useState<string>("");

  // Fetch window and teams data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch window status
      const winRes = await fetch("/api/admin/voting-window");
      const winData = await winRes.json();
      setWindowData(winData.window);
      setWindowStatus(winData.status);

      // 2. Fetch teams and user's voted teams
      const teamsRes = await fetch("/api/teams");
      const teamsData = await teamsRes.json();
      if (teamsData.teams) {
        setTeams(teamsData.teams);
      }
      if (teamsData.votedTeamIds) {
        setVotedTeamIds(new Set(teamsData.votedTeamIds));
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to load voting data." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVote = async (teamId: string, teamName: string) => {
    if (votedTeamIds.has(teamId)) return;
    setVotingOnId(teamId);
    setFeedback(null);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to record vote." });
      } else {
        // Optimistically update local state
        setVotedTeamIds((prev) => new Set([...Array.from(prev), teamId]));
        setTeams((prev) =>
          prev.map((t) => (t.id === teamId ? { ...t, voteCount: data.voteCount } : t))
        );
        setFeedback({
          type: "success",
          text: `Vote recorded for team "${teamName}"!`,
        });
      }
    } catch {
      setFeedback({ type: "error", text: "Network error occurred while voting." });
    } finally {
      setVotingOnId(null);
    }
  };

  const isVotingOpen = windowStatus === "active";

  const filteredTeams = teams.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.members.some((m) => m.name.toLowerCase().includes(q))
    );
  });

  if (loading && teams.length === 0) {
    return (
      <div className="py-16 px-4 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
            <VoteIcon className="w-8 h-8" />
          </div>
          <div className="absolute -inset-2 rounded-2xl border-2 border-indigo-600 border-t-transparent animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">
          Loading Teams & Voting Data...
        </h2>
        <p className="text-xs text-gray-500 mt-1 max-w-sm text-center">
          Fetching submitted squads, project documents, and window status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md mb-2 border border-indigo-100">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cast Your Votes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Team Showcase & Voting
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review each team's submitted Proof of Work (PDF) and vote for your top choices. You can vote for multiple squads!
          </p>
        </div>

        {/* Voting Window Badge */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-w-[260px] text-right flex flex-col items-end">
          <div className="flex items-center space-x-1.5 text-xs text-gray-500 mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Window Status</span>
          </div>

          {isVotingOpen ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              ● Voting Is Open Now
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
              Voting Closed / Not Active
            </span>
          )}

          {windowData && (
            <div className="mt-2 text-[11px] text-gray-500 text-right">
              {windowData.isActive
                ? `${formatDate(windowData.startsAt)} — ${formatDate(windowData.endsAt)}`
                : "No active voting window configured"}
            </div>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between text-sm ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
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

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search teams or member names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="text-xs text-gray-500 flex items-center space-x-2 w-full sm:w-auto justify-end">
          <span>
            Showing <strong>{filteredTeams.length}</strong> {filteredTeams.length === 1 ? "team" : "teams"}
          </span>
          <button
            onClick={loadData}
            className="p-1 text-gray-400 hover:text-gray-700 rounded transition"
            title="Refresh teams"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Voting Window Not Open Notice */}
      {!isVotingOpen && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-900">
          <div className="flex items-start space-x-3">
            <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Voting is currently not open</h3>
              <p className="text-xs text-amber-800 mt-1">
                {windowData?.startsAt && new Date() < new Date(windowData.startsAt)
                  ? `Voting will open on ${formatDate(windowData.startsAt)}. You can browse registered teams and their Proof of Work PDFs below in advance.`
                  : "The event organizers have closed the voting window. You may still review the teams and documents below."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Team Cards Grid */}
      {filteredTeams.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">No teams found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "No teams match your search query."
              : "No teams have been formed yet. Be the first to create a team!"}
          </p>
          {session?.user?.role === "PARTICIPANT" && !searchQuery && (
            <Link
              href="/teams/create"
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition"
            >
              Create Team
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => {
            const hasVoted = votedTeamIds.has(team.id);
            const isVotingThis = votingOnId === team.id;
            const sub = team.submission;

            return (
              <div
                key={team.id}
                className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition shadow-2xs"
              >
                <div className="space-y-4">
                  {/* Top Bar: Team Name & Live Vote Count */}
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight leading-snug">
                      {team.name}
                    </h2>
                    <div className="flex items-center space-x-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-100 flex-shrink-0">
                      <VoteIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">{team.voteCount} votes</span>
                    </div>
                  </div>

                  {/* Proof of Work Card */}
                  <div className="p-3 bg-gray-50/80 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        Proof of Work (PDF)
                      </span>
                      {sub ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
                          Submitted
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-gray-400 italic">
                          Pending Upload
                        </span>
                      )}
                    </div>

                    {sub ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              setViewingPdfUrl(sub.pdfUrl);
                              setViewingTeamName(team.name);
                            }}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition w-full justify-center"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            Open Proof of Work (PDF)
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-500 flex items-center justify-between">
                          <span className="truncate max-w-[170px]" title={sub.fileName}>
                            📄 {sub.fileName}
                          </span>
                          <a
                            href={sub.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline flex items-center"
                          >
                            New Tab <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 py-1">
                        Team has not uploaded project document yet.
                      </p>
                    )}
                  </div>

                  {/* Member Roster (4 Members) */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Team Roster ({team.members.length})
                    </span>
                    <div className="grid grid-cols-1 gap-1">
                      {team.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-50/60 border border-gray-100"
                        >
                          <span className="font-medium text-gray-800 truncate mr-2">
                            {member.name}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-semibold flex-shrink-0 ${
                              member.category === "CS"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {member.category === "CS" ? "CS" : "Core"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Vote Button */}
                <div className="pt-4 border-t border-gray-100 mt-4">
                  {hasVoted ? (
                    <button
                      type="button"
                      disabled
                      className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold cursor-default"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                      Voted for this Team
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!isVotingOpen || isVotingThis}
                      onClick={() => handleVote(team.id, team.name)}
                      className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVotingThis ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Recording Vote...
                        </>
                      ) : !isVotingOpen ? (
                        "Voting Closed"
                      ) : (
                        <>
                          <VoteIcon className="w-3.5 h-3.5 mr-1.5" />
                          Vote for Team
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PDF Viewer Modal */}
      {viewingPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-bold truncate">
                  {viewingTeamName} — Proof of Work Document
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={viewingPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded text-gray-200 transition"
                >
                  Open in New Tab
                </a>
                <button
                  onClick={() => setViewingPdfUrl(null)}
                  className="p-1 text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 p-1">
              <iframe
                src={viewingPdfUrl}
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
