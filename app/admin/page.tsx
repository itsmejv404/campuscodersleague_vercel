"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Clock,
  Award,
  ArrowRight,
  UploadCloud,
  FileSpreadsheet,
  Vote,
  Layers,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  UserCheck,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    participants: 0,
    teams: 0,
    votes: 0,
    admins: 0,
    windowStatus: "Loading...",
  });
  const [loading, setLoading] = useState(true);

  // Reset polling state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTeams, setResetTeams] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadStats = async () => {
    try {
      const [partRes, teamsRes, winRes, adminsRes] = await Promise.all([
        fetch("/api/admin/participants"),
        fetch("/api/teams"),
        fetch("/api/admin/voting-window"),
        fetch("/api/admin/admins"),
      ]);

      const partData = await partRes.json();
      const teamsData = await teamsRes.json();
      const winData = await winRes.json();
      const adminsData = await adminsRes.json();

      const totalVotes = (teamsData.teams || []).reduce(
        (acc: number, t: { voteCount: number }) => acc + (t.voteCount || 0),
        0
      );

      let winLabel = "Not Configured";
      if (winData.status === "active") winLabel = "Live / Active";
      else if (winData.status === "upcoming") winLabel = "Upcoming";
      else if (winData.status === "closed") winLabel = "Ended / Closed";
      else if (winData.status === "disabled") winLabel = "Disabled";

      setStats({
        participants: partData.totalCount || 0,
        teams: teamsData.teams?.length || 0,
        votes: totalVotes,
        admins: adminsData.admins?.length || 0,
        windowStatus: winLabel,
      });
    } catch (err) {
      console.error("Failed to load admin metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
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
        loadStats();
      }
    } catch {
      setResetFeedback({ type: "error", text: "Network error while resetting polling." });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md mb-2 border border-indigo-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Control Panel</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Event Administration Hub
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage participants, configure voting schedules, monitor standings, and control live polling.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setResetFeedback(null);
              setShowResetModal(true);
            }}
            className="inline-flex items-center px-3.5 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-red-600" />
            Reset Polling
          </button>

          <Link
            href="/dashboard"
            className="text-xs text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            ← Voter View
          </Link>
        </div>
      </div>

      {/* Feedback Banner */}
      {resetFeedback && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between text-xs sm:text-sm ${resetFeedback.type === "success"
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

      {/* Stats Counter Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Participants
            </span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {loading ? "..." : stats.participants}
          </div>
          <span className="text-[11px] text-gray-400">Total registered (CS + Core)</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Teams
            </span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {loading ? "..." : stats.teams}
          </div>
          <span className="text-[11px] text-gray-400">Locked 4-member squads</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Votes Cast
            </span>
            <Vote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {loading ? "..." : stats.votes}
          </div>
          <span className="text-[11px] text-gray-400">Cumulative votes</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Voting Status
            </span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-base font-bold text-gray-900 truncate">
            {loading ? "..." : stats.windowStatus}
          </div>
          <span className="text-[11px] text-gray-400">Current window state</span>
        </div>
      </div>

      {/* Admin Sub-modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Module 1: Proof of Work Submissions (NEW) */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition shadow-2xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Proof of Work Submissions</h3>
            <p className="text-xs text-gray-500 mt-1">
              Open/close team submissions, inspect uploaded PDF proof of work files, and track who submitted for each team.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/admin/submissions"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs"
            >
              Manage Submissions
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Link>
          </div>
        </div>

        {/* Module 2: Participants Upload & Directory */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition shadow-2xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
              <UploadCloud className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Participant Registry</h3>
            <p className="text-xs text-gray-500 mt-1">
              View all participants from CS & Core branches, upload via Excel/CSV, and inspect department distribution.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/admin/participants"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs"
            >
              Manage Participants
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Link>
          </div>
        </div>

        {/* Module 3: Team Management */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition shadow-2xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Team Management</h3>
            <p className="text-xs text-gray-500 mt-1">
              Modify team names, change/swap members, update participant information, or disband teams for re-formation.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/admin/teams"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs"
            >
              Manage Teams
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Link>
          </div>
        </div>

        {/* Module 4: Voting Window */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition shadow-2xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4 border border-purple-100">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Voting Window Config</h3>
            <p className="text-xs text-gray-500 mt-1">
              Set start and end dates/times for the live voting window, enable or disable voting on demand.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/admin/voting-window"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs"
            >
              Configure Schedule
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Link>
          </div>
        </div>

        {/* Module 5: Results & Export */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition shadow-2xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Results & Standings</h3>
            <p className="text-xs text-gray-500 mt-1">
              View live leaderboard with vote tallies and percentages, and export to CSV or Excel in uppercase.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/admin/results"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs"
            >
              View & Export Results
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Link>
          </div>
        </div>

        {/* Module 6: Admin Delegation & Roles */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition shadow-2xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100">
              <UserCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900">Admin Privileges</h3>
            <p className="text-xs text-gray-500 mt-1">
              Appoint or revoke administrator permissions. Master Admin (2k24cse073@kiot.ac.in) controls role delegation.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/admin/admins"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs"
            >
              Manage Admins
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Link>
          </div>
        </div>
      </div>

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
