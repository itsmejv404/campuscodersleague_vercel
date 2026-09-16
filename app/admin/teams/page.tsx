"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  ArrowLeft,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Sparkles,
  AlertTriangle,
  Layers,
  Vote,
} from "lucide-react";

interface Member {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  year: string;
  category: "CS" | "NonCS";
}

interface TeamItem {
  id: string;
  name: string;
  createdByParticipantId: string;
  createdAt: string;
  members: Member[];
  voteCount: number;
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [unassigned, setUnassigned] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit modal state
  const [editingTeam, setEditingTeam] = useState<TeamItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editMembers, setEditMembers] = useState<Member[]>([]);
  const [memberEdits, setMemberEdits] = useState<Record<string, { name: string; email: string; phone: string; category: "CS" | "NonCS" }>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");

  // Delete modal state
  const [deletingTeam, setDeletingTeam] = useState<TeamItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create modal state for Admin
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newSelectedMemberIds, setNewSelectedMemberIds] = useState<string[]>([]);
  const [createSearchQuery, setCreateSearchQuery] = useState("");
  const [createCategoryFilter, setCreateCategoryFilter] = useState<"ALL" | "CS" | "NonCS">("ALL");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teams");
      const data = await res.json();
      if (data.teams) {
        setTeams(data.teams);
      }
      if (data.unassignedParticipants) {
        setUnassigned(data.unassignedParticipants);
      }
    } catch {
      setFeedback({ type: "error", text: "Failed to load teams." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const openEditModal = (team: TeamItem) => {
    setEditingTeam(team);
    setEditName(team.name);
    setEditMembers([...team.members]);
    const edits: Record<string, { name: string; email: string; phone: string; category: "CS" | "NonCS" }> = {};
    team.members.forEach((m) => {
      edits[m.id] = {
        name: m.name,
        email: m.email,
        phone: m.phone,
        category: m.category,
      };
    });
    setMemberEdits(edits);
    setAddMemberId("");
  };

  const handleMemberFieldChange = (id: string, field: "name" | "email" | "phone" | "category", value: string) => {
    setMemberEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleRemoveMember = (id: string) => {
    setEditMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddMember = () => {
    if (!addMemberId) return;
    const found = unassigned.find((p) => p.id === addMemberId);
    if (!found) return;

    setEditMembers((prev) => [...prev, found]);
    setMemberEdits((prev) => ({
      ...prev,
      [found.id]: {
        name: found.name,
        email: found.email,
        phone: found.phone,
        category: found.category,
      },
    }));
    setAddMemberId("");
  };

  const handleSaveEdit = async () => {
    if (!editingTeam) return;
    setSavingEdit(true);
    setFeedback(null);

    try {
      const memberUpdates = Object.entries(memberEdits).map(([id, data]) => ({
        id,
        ...data,
      }));

      const res = await fetch(`/api/admin/teams/${editingTeam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          memberIds: editMembers.map((m) => m.id),
          memberUpdates,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update team." });
      } else {
        setFeedback({ type: "success", text: `Team "${editName}" and members updated successfully!` });
        setEditingTeam(null);
        fetchTeams();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while saving team changes." });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!deletingTeam) return;
    setDeleting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/teams/${deletingTeam.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to disband team." });
      } else {
        setFeedback({ type: "success", text: data.message || "Team disbanded successfully!" });
        setDeletingTeam(null);
        fetchTeams();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while disbanding team." });
    } finally {
      setDeleting(false);
    }
  };

  const openCreateModal = () => {
    setNewTeamName("");
    setNewSelectedMemberIds([]);
    setCreateSearchQuery("");
    setCreateCategoryFilter("ALL");
    setShowCreateModal(true);
  };

  const handleCreateTeam = async () => {
    const cleanName = newTeamName.trim();
    if (!cleanName) {
      setFeedback({ type: "error", text: "Please provide a team name." });
      return;
    }

    if (newSelectedMemberIds.length === 0) {
      setFeedback({ type: "error", text: "Please select at least 1 member for the team." });
      return;
    }

    setCreatingTeam(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          memberIds: newSelectedMemberIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to create team." });
      } else {
        setFeedback({
          type: "success",
          text: data.message || `Team "${cleanName}" created successfully!`,
        });
        setShowCreateModal(false);
        fetchTeams();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while creating team." });
    } finally {
      setCreatingTeam(false);
    }
  };

  const filteredTeams = teams.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.members.some(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.studentId.toLowerCase().includes(q)
      )
    );
  });

  if (loading && teams.length === 0 && unassigned.length === 0) {
    return (
      <div className="py-16 px-4 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm animate-pulse">
            <Users className="w-8 h-8" />
          </div>
          <div className="absolute -inset-2 rounded-2xl border-2 border-indigo-600 border-t-transparent animate-spin" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">
          Loading Admin Squads...
        </h2>
        <p className="text-xs text-gray-500 mt-1 max-w-sm text-center">
          Fetching team compositions and unassigned participant rosters.
        </p>
      </div>
    );
  }

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
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Management</h1>
            <p className="text-xs text-gray-500">
              Modify team names, adjust rosters, update participant records, or disband teams to allow re-formation.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchTeams}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Team (Admin)
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

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search teams or member names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="text-xs text-gray-500 flex items-center space-x-2">
          <span>
            Total Formed Teams: <strong>{teams.length}</strong> • Unassigned Participants:{" "}
            <strong>{unassigned.length}</strong>
          </span>
        </div>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">No teams found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "No teams match your search query."
              : "No teams have been formed yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-2xs hover:border-gray-300 transition flex flex-col justify-between"
            >
              <div>
                {/* Team Top Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">{team.name}</h2>
                    <span className="text-[11px] text-gray-400">
                      {team.members.length} Members • Created {new Date(team.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold border border-indigo-100">
                      <Vote className="w-3 h-3" />
                      <span>{team.voteCount}</span>
                    </div>

                    <button
                      onClick={() => openEditModal(team)}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                      title="Edit team & members"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeletingTeam(team)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                      title="Disband / Delete team"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Member Roster */}
                <div className="space-y-1.5 mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Member Roster
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {team.members.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 flex flex-col justify-between text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900 truncate mr-1.5">{m.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold flex-shrink-0 ${
                              m.category === "CS"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {m.category === "CS" ? "CS" : "Core"}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">{m.studentId} • {m.email}</div>
                        {m.phone && m.phone !== "N/A" && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{m.phone}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-end space-x-2 text-xs">
                <button
                  onClick={() => openEditModal(team)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition"
                >
                  Edit Roster / Data
                </button>
                <button
                  onClick={() => setDeletingTeam(team)}
                  className="px-3 py-1.5 border border-red-200 bg-red-50 text-red-700 rounded-md hover:bg-red-100 font-medium transition"
                >
                  Disband Team
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Team & Members Modal */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Edit Team & Member Data</h3>
                <p className="text-xs text-gray-500">
                  Update team name, swap or add members, and modify student contact details.
                </p>
              </div>
              <button
                onClick={() => setEditingTeam(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6 flex-1">
              {/* Team Name Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Team Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Members Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Current Members ({editMembers.length})
                  </span>
                  <span className="text-xs text-gray-400">
                    CS: {editMembers.filter((m) => (memberEdits[m.id]?.category || m.category) === "CS").length} •{" "}
                    Core: {editMembers.filter((m) => (memberEdits[m.id]?.category || m.category) === "NonCS").length}
                  </span>
                </div>

                <div className="space-y-3">
                  {editMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-3.5 border border-gray-200 rounded-lg bg-gray-50/50 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-gray-900">
                            {member.studentId}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              (memberEdits[member.id]?.category || member.category) === "CS"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {(memberEdits[member.id]?.category || member.category) === "CS" ? "CS" : "Core"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-xs text-red-600 hover:text-red-800 hover:underline flex items-center"
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Unassign from Team
                        </button>
                      </div>

                      {/* Editable Member Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Name</label>
                          <input
                            type="text"
                            value={memberEdits[member.id]?.name ?? member.name}
                            onChange={(e) => handleMemberFieldChange(member.id, "name", e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Email</label>
                          <input
                            type="email"
                            value={memberEdits[member.id]?.email ?? member.email}
                            onChange={(e) => handleMemberFieldChange(member.id, "email", e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Phone</label>
                          <input
                            type="text"
                            value={memberEdits[member.id]?.phone ?? member.phone}
                            onChange={(e) => handleMemberFieldChange(member.id, "phone", e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Category</label>
                          <select
                            value={memberEdits[member.id]?.category ?? member.category}
                            onChange={(e) => handleMemberFieldChange(member.id, "category", e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                          >
                            <option value="CS">CS</option>
                            <option value="NonCS">Core</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Member from Unassigned Pool */}
              <div className="p-3.5 border border-dashed border-gray-300 rounded-lg bg-gray-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Add Member from Unassigned Pool</span>
                  <span className="text-[11px] text-gray-400">Admins can assign any number of members</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={addMemberId}
                    onChange={(e) => setAddMemberId(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Select an unassigned participant...</option>
                    {unassigned
                      .filter((p) => !editMembers.some((m) => m.id === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.category === "CS" ? "CS" : "Core"}] {p.name} ({p.studentId} - {p.email})
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    disabled={!addMemberId}
                    onClick={handleAddMember}
                    className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add to Roster
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit || !editName.trim()}
                onClick={handleSaveEdit}
                className="inline-flex items-center px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {savingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disband / Delete Confirmation Modal */}
      {deletingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-gray-900">Disband & Delete Team</h3>
              </div>
              <button onClick={() => setDeletingTeam(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to disband <strong>&quot;{deletingTeam.name}&quot;</strong>?
            </p>

            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
              <p>• The team and any votes cast for it will be removed.</p>
              <p>• All <strong>{deletingTeam.members.length} members</strong> will be unassigned and returned to the participant pool, allowing them to form or join another team freely.</p>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingTeam(null)}
                className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteTeam}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Disbanding...
                  </>
                ) : (
                  "Confirm Disband"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team as Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-gray-900 text-base">Create Team (Admin Mode)</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    SUPERUSER
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create a team with any number of members regardless of branch or category (all CS, all Core, or any mix).
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5 flex-1">
              {/* Informational Callout */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex items-start space-x-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Unrestricted Team Formation:</span> As an administrator, you have full flexibility. You can assign 1, 2, 3, 4, 5, or more students to a team without any category constraints.
                </div>
              </div>

              {/* Team Name Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quantum Pioneers"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="block w-full px-3.5 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {/* Selected Members Roster */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Selected Team Members ({newSelectedMemberIds.length})
                  </span>
                  <span className="text-xs text-gray-500">
                    CS: {newSelectedMemberIds.filter((id) => unassigned.find((p) => p.id === id)?.category === "CS").length} •{" "}
                    Core: {newSelectedMemberIds.filter((id) => unassigned.find((p) => p.id === id)?.category === "NonCS").length}
                  </span>
                </div>

                {newSelectedMemberIds.length === 0 ? (
                  <div className="p-4 border border-dashed border-gray-200 rounded-lg text-center text-xs text-gray-400 bg-gray-50/50">
                    No members selected yet. Use the participant search below to add members to this team.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {newSelectedMemberIds.map((id) => {
                      const p = unassigned.find((item) => item.id === id);
                      if (!p) return null;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-900">{p.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                p.category === "CS"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {p.category === "CS" ? "CS" : "Core"}
                            </span>
                            <span className="text-gray-400 font-mono text-[11px]">{p.studentId}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setNewSelectedMemberIds((prev) => prev.filter((mid) => mid !== p.id))
                            }
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove participant"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Members from Unassigned Pool */}
              <div className="space-y-2.5 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Add Available Participants</span>
                  <span className="text-xs text-gray-400">
                    {unassigned.length - newSelectedMemberIds.length} available to choose
                  </span>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search students by name, ID, email..."
                      value={createSearchQuery}
                      onChange={(e) => setCreateSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>

                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setCreateCategoryFilter("ALL")}
                      className={`px-2.5 py-1 font-medium transition ${
                        createCategoryFilter === "ALL"
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateCategoryFilter("CS")}
                      className={`px-2.5 py-1 font-medium transition ${
                        createCategoryFilter === "CS"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      CS
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateCategoryFilter("NonCS")}
                      className={`px-2.5 py-1 font-medium transition ${
                        createCategoryFilter === "NonCS"
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Core
                    </button>
                  </div>
                </div>

                {/* Unassigned candidate list */}
                <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {unassigned
                    .filter((p) => !newSelectedMemberIds.includes(p.id))
                    .filter((p) => {
                      if (createCategoryFilter === "CS") return p.category === "CS";
                      if (createCategoryFilter === "NonCS") return p.category === "NonCS";
                      return true;
                    })
                    .filter((p) => {
                      if (!createSearchQuery.trim()) return true;
                      const q = createSearchQuery.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.studentId.toLowerCase().includes(q) ||
                        p.email.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 50)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 flex items-center justify-between hover:bg-gray-50 text-xs"
                      >
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-gray-900">{p.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                p.category === "CS"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {p.category === "CS" ? "CS" : "Core"}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {p.studentId} • {p.email}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setNewSelectedMemberIds((prev) => [...prev, p.id])}
                          className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingTeam || !newTeamName.trim() || newSelectedMemberIds.length === 0}
                onClick={handleCreateTeam}
                className="inline-flex items-center px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {creatingTeam ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Creating Team...
                  </>
                ) : (
                  `Create Team (${newSelectedMemberIds.length} members)`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
