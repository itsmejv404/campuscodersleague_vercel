"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminVotingWindowPage() {
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<string>("loading");
  const [existingWindow, setExistingWindow] = useState<{
    id: string;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Helper to format Date into datetime-local input string YYYY-MM-DDTHH:mm
  const toLocalInputFormat = (isoString: string) => {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fetchWindow = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/voting-window");
      const data = await res.json();
      if (data.window) {
        setExistingWindow(data.window);
        setStartsAt(toLocalInputFormat(data.window.startsAt));
        setEndsAt(toLocalInputFormat(data.window.endsAt));
        setIsActive(data.window.isActive);
        setCurrentStatus(data.status);
      } else {
        // Defaults: starts now, ends in 24 hours
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        setStartsAt(toLocalInputFormat(now.toISOString()));
        setEndsAt(toLocalInputFormat(tomorrow.toISOString()));
        setIsActive(true);
        setCurrentStatus("not_configured");
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to load voting window settings." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWindow();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setFeedback({ type: "error", text: "Please provide valid start and end dates/times." });
      return;
    }

    if (startDate >= endDate) {
      setFeedback({ type: "error", text: "Start time must be strictly before end time." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/voting-window", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
          isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update voting window." });
      } else {
        setFeedback({
          type: "success",
          text: "Voting window schedule successfully saved!",
        });
        fetchWindow();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error occurred." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
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
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Voting Window Schedule
            </h1>
            <p className="text-xs text-gray-500">
              Define the exact start and end timeline during which all participants and voters can cast votes.
            </p>
          </div>
        </div>

        {/* Current status display */}
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
          <div className="text-xs text-gray-700">
            <strong>Current Live Status: </strong>
            <span className="capitalize">{currentStatus.replace("_", " ")}</span>
          </div>

          <div>
            {currentStatus === "active" ? (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ● Live Open
              </span>
            ) : currentStatus === "upcoming" ? (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Scheduled / Upcoming
              </span>
            ) : currentStatus === "disabled" ? (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Manually Disabled
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                Closed / Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg border text-sm flex items-start ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Start Datetime */}
            <div>
              <label
                htmlFor="startsAt"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Voting Start Time
              </label>
              <input
                id="startsAt"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="block w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
              />
              <p className="mt-1 text-xs text-gray-400">
                Local time when voting begins.
              </p>
            </div>

            {/* End Datetime */}
            <div>
              <label
                htmlFor="endsAt"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Voting End Time
              </label>
              <input
                id="endsAt"
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="block w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
              />
              <p className="mt-1 text-xs text-gray-400">
                Local time when voting automatically concludes.
              </p>
            </div>
          </div>

          {/* Active Switch */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-900">Enable Voting Window</span>
              <p className="text-xs text-gray-500">
                When switched off, voting remains closed regardless of the schedule.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
            <Link
              href="/admin"
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving Schedule...
                </>
              ) : (
                "Save Voting Window"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
