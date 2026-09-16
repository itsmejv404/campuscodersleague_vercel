"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Plus,
  X,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";

interface ParticipantItem {
  id: string;
  studentId: string;
  name: string;
  email: string;
  gender: string;
  phone: string;
  year: string;
  category: "CS" | "NonCS";
}

export default function CreateTeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [teamName, setTeamName] = useState("");
  const [availableParticipants, setAvailableParticipants] = useState<ParticipantItem[]>([]);
  const [existingTeamNames, setExistingTeamNames] = useState<Set<string>>(new Set());
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<(ParticipantItem | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [modalCategoryTab, setModalCategoryTab] = useState<"ALL" | "CS" | "NonCS">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [isLastTeamsAdvantage, setIsLastTeamsAdvantage] = useState(false);

  // Fetch available participants & existing team names
  const fetchAvailable = async () => {
    setLoadingParticipants(true);
    try {
      const [partRes, teamsRes] = await Promise.all([
        fetch("/api/participants/available"),
        fetch("/api/teams"),
      ]);

      const partData = await partRes.json();
      const teamsData = await teamsRes.json();

      if (teamsData.isLastTeamsAdvantage) {
        setIsLastTeamsAdvantage(true);
      }

      if (teamsData.teams) {
        const names = new Set<string>(
          teamsData.teams.map((t: { name: string }) => t.name.trim().toLowerCase())
        );
        setExistingTeamNames(names);
      }

      if (partData.participants) {
        setAvailableParticipants(partData.participants);

        // Pre-fill slot 0 with the current logged-in participant if not set
        if (session?.user?.participantId) {
          const self = partData.participants.find(
            (p: ParticipantItem) => p.id === session.user.participantId
          );
          if (self) {
            setSelectedMembers((prev) => {
              if (!prev[0]) {
                const next = [...prev];
                next[0] = self;
                return next;
              }
              return prev;
            });
          }
        }
      }
    } catch {
      setFormError("Failed to fetch available participants. Please refresh the page.");
    } finally {
      setLoadingParticipants(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchAvailable();
    }
  }, [status, session]);

  // Calculate current composition
  const filledMembers = selectedMembers.filter(Boolean) as ParticipantItem[];
  const csCount = filledMembers.filter((m) => m.category === "CS").length;
  const nonCsCount = filledMembers.filter((m) => m.category === "NonCS").length;
  const isValidComposition = isLastTeamsAdvantage
    ? filledMembers.length >= 3 && filledMembers.length <= 4
    : csCount === 3 && nonCsCount === 1 && filledMembers.length === 4;

  // Real-time team name validation
  const cleanTeamName = teamName.trim();
  const isNameDuplicate = cleanTeamName.length >= 2 && existingTeamNames.has(cleanTeamName.toLowerCase());

  // Handle opening modal with smart auto-filtering
  const handleOpenSlot = (slotIdx: number) => {
    setActiveSlot(slotIdx);
    setSearchQuery("");

    // If already 3 CS members chosen, auto-switch to Core tab!
    if (csCount >= 3 && nonCsCount === 0) {
      setModalCategoryTab("NonCS");
    } else if (nonCsCount >= 1 && csCount < 3) {
      // If 1 Core already chosen, auto-switch to CS tab!
      setModalCategoryTab("CS");
    } else {
      setModalCategoryTab("ALL");
    }
  };

  // Filter available participants for the search picker
  const filteredParticipants = useMemo(() => {
    const selectedIds = new Set(filledMembers.map((m) => m.id));
    return availableParticipants
      .filter((p) => !selectedIds.has(p.id))
      .filter((p) => {
        if (modalCategoryTab === "CS") return p.category === "CS";
        if (modalCategoryTab === "NonCS") return p.category === "NonCS";
        return true;
      })
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.studentId.toLowerCase().includes(q)
        );
      });
  }, [availableParticipants, filledMembers, searchQuery, modalCategoryTab]);

  // Available counts for tab badges
  const unselectedParticipants = useMemo(() => {
    const selectedIds = new Set(filledMembers.map((m) => m.id));
    return availableParticipants.filter((p) => !selectedIds.has(p.id));
  }, [availableParticipants, filledMembers]);

  const totalUnselectedCS = useMemo(() => {
    return unselectedParticipants.filter((p) => p.category === "CS").length;
  }, [unselectedParticipants]);

  const totalUnselectedCore = useMemo(() => {
    return unselectedParticipants.filter((p) => p.category === "NonCS").length;
  }, [unselectedParticipants]);

  const handleSelectMember = (participant: ParticipantItem) => {
    if (activeSlot === null) return;
    const next = [...selectedMembers];
    next[activeSlot] = participant;
    setSelectedMembers(next);
    setActiveSlot(null);
    setSearchQuery("");
  };

  const handleRemoveMember = (slotIndex: number) => {
    const next = [...selectedMembers];
    next[slotIndex] = null;
    setSelectedMembers(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!cleanTeamName) {
      setFormError("Please enter a team name.");
      return;
    }

    if (cleanTeamName.length < 2 || cleanTeamName.length > 60) {
      setFormError("Team name must be between 2 and 60 characters.");
      return;
    }

    if (isNameDuplicate) {
      setFormError(`The team name "${cleanTeamName}" is already registered. Please choose a unique name.`);
      return;
    }

    if (!isLastTeamsAdvantage) {
      if (filledMembers.length !== 4) {
        setFormError("All 4 team member slots must be selected for standard team formation.");
        return;
      }

      if (csCount !== 3 || nonCsCount !== 1) {
        setFormError(
          `Invalid composition: Exactly 3 CS and 1 Core student are required. Currently: ${csCount} CS, ${nonCsCount} Core.`
        );
        return;
      }
    } else {
      if (filledMembers.length < 3 || filledMembers.length > 4) {
        setFormError("Under Last Teams Advantage, your team must have either 3 or 4 members.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanTeamName,
          memberIds: filledMembers.map((m) => m.id),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to create team.");
        fetchAvailable();
      } else {
        setFormSuccess(
          data.message || "Team created successfully! Redirecting to dashboard..."
        );
        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 1200);
      }
    } catch {
      setFormError("A network error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || (loadingParticipants && availableParticipants.length === 0 && !formError)) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
        </div>
        <p className="text-sm font-medium text-gray-600">
          Loading...
        </p>
      </div>
    );
  }

  if (formError && availableParticipants.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-xs font-medium text-gray-500 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Dashboard
          </Link>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Failed to Load Participant Data</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-md">
            {formError}
          </p>
          <button
            type="button"
            onClick={fetchAvailable}
            className="mt-5 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-2" />
            Retry Fetching Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-xs font-medium text-gray-500 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Dashboard
        </Link>
      </div>

      {/* Page Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create a Team</h1>
            <p className="text-xs text-gray-500">
              {isLastTeamsAdvantage
                ? "Last Teams Advantage Active: Flexible 3-4 member squad with available peers."
                : "Form your 4-student squad strictly adhering to the 3 CS + 1 Core composition rule."}
            </p>
          </div>
        </div>

        {/* Admin Superuser Banner */}
        {session?.user?.role === "ADMIN" && (
          <div className="mt-4 p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-indigo-900">
              <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>
                <strong>Admin Superuser Active:</strong> You can create teams with any number of members (1, 2, 3, 4, 5, 6+) irrespective of category from the Admin Teams management portal.
              </span>
            </div>
            <Link
              href="/admin/teams"
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs whitespace-nowrap text-center transition shadow-2xs"
            >
              Go to Admin Team Creation →
            </Link>
          </div>
        )}

        {/* Rule callout badge */}
        {isLastTeamsAdvantage ? (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Last Teams Advantage Active!</strong> Because remaining unassigned participant numbers are low, your team is permitted to have <strong>3 or 4 members</strong> with flexible CS & Core ratios.
              </span>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Selected: {filledMembers.length}/(3 or 4)
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-gray-700">
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>
                <strong>Rule Requirement:</strong> Every team must have exactly{" "}
                <span className="font-semibold text-blue-700">3 CS students</span> and{" "}
                <span className="font-semibold text-purple-700">1 Core student</span>.
              </span>
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${csCount === 3
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
              >
                CS: {csCount}/3
              </span>
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-semibold ${nonCsCount === 1
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-purple-50 text-purple-700 border border-purple-200"
                  }`}
              >
                Core: {nonCsCount}/1
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {formError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0 text-red-500" />
          <span>{formError}</span>
        </div>
      )}

      {formSuccess && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 flex items-start text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0 text-green-500" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Team Name Input with Real-time Uniqueness Validation */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <label
            htmlFor="teamName"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5"
          >
            Team Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="teamName"
              type="text"
              required
              placeholder="e.g. Quantum Innovators"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setFormError(null);
              }}
              className={`block w-full px-3.5 py-2.5 text-sm border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${isNameDuplicate
                  ? "border-red-300 focus:ring-red-500 bg-red-50/20"
                  : cleanTeamName.length >= 2
                    ? "border-emerald-300 focus:ring-emerald-500"
                    : "border-gray-300 focus:ring-indigo-600"
                }`}
            />
          </div>

          {/* Real-time Uniqueness Feedback */}
          {cleanTeamName.length >= 2 && (
            <div className="mt-1.5 text-xs">
              {isNameDuplicate ? (
                <span className="text-red-600 flex items-center font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-500" />
                  Team name &quot;{cleanTeamName}&quot; is already taken. Please choose a unique name.
                </span>
              ) : (
                <span className="text-emerald-600 flex items-center font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  Unique team name available.
                </span>
              )}
            </div>
          )}

          <p className="mt-1 text-xs text-gray-400">
            Team name must be strictly unique.
          </p>
        </div>

        {/* 4 Member Slots */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Team Members (4 Slots)</h2>
              <p className="text-xs text-gray-500">
                Select 3 CS students + 1 Core student from the participant pool.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAvailable}
              disabled={loadingParticipants}
              className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-700"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1 ${loadingParticipants ? "animate-spin" : ""}`}
              />
              Refresh Roster
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedMembers.map((member, slotIdx) => (
              <div
                key={slotIdx}
                className={`border rounded-lg p-4 transition ${member
                    ? "bg-white border-gray-200 shadow-2xs"
                    : activeSlot === slotIdx
                      ? "border-indigo-600 bg-indigo-50/20"
                      : "border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-50"
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500">Slot {slotIdx + 1}</span>
                  {member && (
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded font-semibold ${member.category === "CS"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                          }`}
                      >
                        {member.category === "CS" ? "CS" : "Core"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(slotIdx)}
                        className="text-gray-400 hover:text-red-500 p-0.5 rounded transition"
                        title="Remove member"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {member ? (
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{member.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{member.email}</div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      ID: {member.studentId} • Year: {member.year}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenSlot(slotIdx)}
                    className="w-full py-4 flex flex-col items-center justify-center text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    <Plus className="w-4 h-4 mb-1 text-indigo-600" />
                    Assign Participant to Slot {slotIdx + 1}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs">
            {isValidComposition ? (
              <span className="inline-flex items-center text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-500" />
                {isLastTeamsAdvantage
                  ? `Team structure is complete & valid (${filledMembers.length} members)`
                  : "Team structure is complete & valid (3 CS + 1 Core)"}
              </span>
            ) : (
              <span className="text-gray-500">
                {isLastTeamsAdvantage
                  ? `Please select at least 3 members (currently ${filledMembers.length} selected)`
                  : `Remaining: ${3 - csCount > 0 ? `${3 - csCount} CS` : ""} ${1 - nonCsCount > 0 ? `${1 - nonCsCount} Core` : ""
                  }`}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto text-center px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !isValidComposition || !cleanTeamName || isNameDuplicate}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating Team...
                </>
              ) : (
                "Lock & Register Team"
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Member Selection Modal with Category Tabs & Core Access */}
      {activeSlot !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm sm:text-base">
                  Select Member for Slot {activeSlot + 1}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Needed for team:{" "}
                  {3 - csCount > 0 && `${3 - csCount} CS`}{" "}
                  {3 - csCount > 0 && 1 - nonCsCount > 0 && "• "}{" "}
                  {1 - nonCsCount > 0 && `${1 - nonCsCount} Core`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Smart Recommendation Banner */}
            {nonCsCount === 0 && csCount >= 2 && (
              <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between text-xs text-purple-800">
                <span>
                  💡 <strong>1 Core student required!</strong> ECE, ECX, EEE, Civil, Mech, MCA.
                </span>
                {modalCategoryTab !== "NonCS" && (
                  <button
                    type="button"
                    onClick={() => setModalCategoryTab("NonCS")}
                    className="font-semibold underline ml-2 hover:text-purple-900"
                  >
                    View Core list
                  </button>
                )}
              </div>
            )}

            {/* Category Filter Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/70 px-4 pt-2 gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setModalCategoryTab("ALL")}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${modalCategoryTab === "ALL"
                    ? "border-indigo-600 text-indigo-600 bg-white rounded-t-md"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                  }`}
              >
                All Available ({unselectedParticipants.length})
              </button>

              <button
                type="button"
                onClick={() => setModalCategoryTab("CS")}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${modalCategoryTab === "CS"
                    ? "border-blue-600 text-blue-700 bg-white rounded-t-md"
                    : "border-transparent text-gray-500 hover:text-gray-900"
                  }`}
              >
                CS Students ({totalUnselectedCS})
              </button>

              <button
                type="button"
                onClick={() => setModalCategoryTab("NonCS")}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap flex items-center space-x-1 ${modalCategoryTab === "NonCS"
                    ? "border-purple-600 text-purple-700 bg-white rounded-t-md font-bold"
                    : "border-transparent text-purple-600 hover:text-purple-900 font-medium"
                  }`}
              >
                <span>Core Students ({totalUnselectedCore})</span>
                {nonCsCount === 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                )}
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${modalCategoryTab === "NonCS" ? "Core" : modalCategoryTab === "CS" ? "CS" : ""} participants by name, ID, or email...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  autoFocus
                />
              </div>
            </div>

            {/* Participant List */}
            <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
              {filteredParticipants.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400">
                  {searchQuery
                    ? "No available participants matching search in this category."
                    : "No unassigned participants available in this tab."}
                </div>
              ) : (
                filteredParticipants.map((p) => {
                  const isSuggested =
                    (p.category === "CS" && csCount < 3) ||
                    (p.category === "NonCS" && nonCsCount < 1);

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectMember(p)}
                      className={`p-2.5 border rounded-lg hover:border-indigo-600 hover:bg-indigo-50/20 cursor-pointer transition flex items-center justify-between ${p.category === "NonCS" ? "border-purple-200 bg-purple-50/20" : "border-gray-200"
                        }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs sm:text-sm font-semibold text-gray-900">
                            {p.name}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${p.category === "CS"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                              }`}
                          >
                            {p.category === "CS" ? "CS" : "Core"}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {p.studentId} • {p.email}
                        </div>
                      </div>

                      {isSuggested && (
                        <span className="text-[9px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          Matches Need
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing <strong>{filteredParticipants.length}</strong> candidates
              </span>
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
