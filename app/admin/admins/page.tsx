"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Trash2,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Mail,
  Calendar,
  Lock,
  X,
} from "lucide-react";

interface AdminRecord {
  id: string;
  email: string;
  role: string;
  isMasterAdmin: boolean;
  createdAt: string;
  name: string | null;
  studentId: string | null;
  category: string | null;
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCurrentUserMasterAdmin, setIsCurrentUserMasterAdmin] = useState(false);
  const [masterAdminEmail, setMasterAdminEmail] = useState("");

  // Modal & form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Revoke state
  const [targetRevokeEmail, setTargetRevokeEmail] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/admins");
      const data = await res.json();
      if (res.ok) {
        setAdmins(data.admins || []);
        setIsCurrentUserMasterAdmin(data.isCurrentUserMasterAdmin || false);
        setMasterAdminEmail(data.masterAdminEmail || "");
      } else {
        setFeedback({
          type: "error",
          text: data.error || "Failed to load administrator accounts.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Network error while loading administrator accounts.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to add administrator." });
      } else {
        setFeedback({
          type: "success",
          text: data.message || `Admin privileges granted to ${newAdminEmail.trim()}.`,
        });
        setNewAdminEmail("");
        setShowAddModal(false);
        fetchAdmins();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error while appointing administrator." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeAdmin = async () => {
    if (!targetRevokeEmail) return;

    setRevoking(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetRevokeEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error || "Failed to revoke admin privileges.",
        });
      } else {
        setFeedback({
          type: "success",
          text: data.message || `Admin privileges revoked for ${targetRevokeEmail}.`,
        });
        setTargetRevokeEmail(null);
        fetchAdmins();
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Network error while revoking admin privileges.",
      });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md mb-2 border border-indigo-100">
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Access Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Administrator Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage authorized administrators. Master Admin ({masterAdminEmail || "2k24cse073@kiot.ac.in"}) possesses full authority to grant or revoke admin privileges.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isCurrentUserMasterAdmin && (
            <button
              onClick={() => {
                setFeedback(null);
                setShowAddModal(true);
              }}
              className="inline-flex items-center px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Add Administrator
            </button>
          )}

          <Link
            href="/admin"
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Admin Hub
          </Link>
        </div>
      </div>

      {/* Permission Notice for Delegated Admins */}
      {!isCurrentUserMasterAdmin && !loading && (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-xs sm:text-sm flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Delegated Administrator View</p>
            <p className="text-xs text-blue-700 mt-0.5">
              You are signed in as a delegated administrator. Only the Master Admin (<strong>{masterAdminEmail || "2k24cse073@kiot.ac.in"}</strong>) has authority to appoint or revoke administrator accounts.
            </p>
          </div>
        </div>
      )}

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
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
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

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Administrators
            </span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {loading ? "..." : admins.length}
          </div>
          <span className="text-[11px] text-gray-400">Master + Delegated</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Master Admin
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-sm font-bold text-gray-900 truncate">
            {masterAdminEmail || "2k24cse073@kiot.ac.in"}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Permanent / Immutable</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Delegated Admins
            </span>
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {loading ? "..." : admins.filter((a) => !a.isMasterAdmin).length}
          </div>
          <span className="text-[11px] text-gray-400">Managed via Dashboard</span>
        </div>
      </div>

      {/* Admins Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Active Administrator Accounts</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Authorized personnel with access to event settings, participant rosters, and results.
            </p>
          </div>
          <button
            onClick={fetchAdmins}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
              <tr>
                <th scope="col" className="px-6 py-3.5">
                  Administrator
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Account Type
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Participant Match
                </th>
                <th scope="col" className="px-6 py-3.5">
                  Registered Date
                </th>
                <th scope="col" className="px-6 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading administrator directory...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    No administrators found.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          admin.isMasterAdmin
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-indigo-100 text-indigo-700 border border-indigo-200"
                        }`}>
                          {admin.email.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 flex items-center space-x-1.5">
                            <span>{admin.email}</span>
                          </div>
                          {admin.name && (
                            <span className="text-[11px] text-gray-500">{admin.name}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {admin.isMasterAdmin ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Lock className="w-3 h-3 mr-1 text-amber-600" />
                          Master Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <ShieldCheck className="w-3 h-3 mr-1 text-indigo-600" />
                          Delegated Admin
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-gray-600">
                      {admin.studentId ? (
                        <div>
                          <span className="font-medium text-gray-800">{admin.studentId}</span>
                          {admin.category && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                              {admin.category}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Not in roster</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {new Date(admin.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      {admin.isMasterAdmin ? (
                        <span className="text-xs text-gray-400 italic">Protected</span>
                      ) : isCurrentUserMasterAdmin ? (
                        <button
                          onClick={() => setTargetRevokeEmail(admin.email)}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-200"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Revoke
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">View Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Admin */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5 text-indigo-600">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="text-base font-bold text-gray-900">Appoint New Administrator</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Enter the institutional email address of the user you want to grant administrator access.
            </p>

            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="user@kiot.ac.in"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Granting...
                    </>
                  ) : (
                    "Grant Admin Access"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Revoke Confirmation */}
      {targetRevokeEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5 text-red-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base font-bold text-gray-900">Revoke Admin Access</h3>
              </div>
              <button
                onClick={() => setTargetRevokeEmail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to revoke admin privileges for <strong>{targetRevokeEmail}</strong>? They will be demoted to their default participant or voter role.
            </p>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setTargetRevokeEmail(null)}
                className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={handleRevokeAdmin}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition"
              >
                {revoking ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  "Confirm Revoke"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
