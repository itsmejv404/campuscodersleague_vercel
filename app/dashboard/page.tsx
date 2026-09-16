"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Vote,
  Users,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  UploadCloud,
  RefreshCw,
  Eye,
  ExternalLink,
  X,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface VotingWindowData {
  id: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
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

interface TeamData {
  id: string;
  name: string;
  members: Array<{
    id: string;
    studentId: string;
    name: string;
    category: "CS" | "NonCS";
  }>;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [windowData, setWindowData] = useState<VotingWindowData | null>(null);
  const [windowStatus, setWindowStatus] = useState<string>("loading");
  const [countdownText, setCountdownText] = useState<string>("");
  const [myTeam, setMyTeam] = useState<TeamData | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Submission State
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(true);
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [previewPdfModal, setPreviewPdfModal] = useState<string | null>(null);

  // Fetch active voting window
  useEffect(() => {
    async function fetchWindow() {
      try {
        const res = await fetch("/api/admin/voting-window");
        const data = await res.json();
        if (data.window) {
          setWindowData(data.window);
          setWindowStatus(data.status);
        } else {
          setWindowStatus("not_configured");
        }
      } catch {
        setWindowStatus("error");
      }
    }
    fetchWindow();
  }, []);

  // Fetch participant's team if they are in one
  const fetchMyTeam = async () => {
    if (session?.user?.role === "PARTICIPANT") {
      setLoadingTeam(true);
      try {
        const res = await fetch("/api/teams");
        const data = await res.json();
        if (data.teams && session.user.participantId) {
          const found = data.teams.find((t: TeamData) =>
            t.members.some((m) => m.id === session.user.participantId)
          );
          if (found) {
            setMyTeam(found);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoadingTeam(false);
      }
    }
  };

  useEffect(() => {
    fetchMyTeam();
  }, [session]);

  // Fetch submission status
  const fetchSubmissionStatus = async () => {
    if (session?.user?.role === "PARTICIPANT") {
      setLoadingSubmission(true);
      try {
        const res = await fetch("/api/teams/submission");
        const data = await res.json();
        setSubmission(data.submission || null);
        setIsSubmissionOpen(data.isWindowOpen ?? true);
      } catch {
        // ignore
      } finally {
        setLoadingSubmission(false);
      }
    }
  };

  useEffect(() => {
    if (myTeam) {
      fetchSubmissionStatus();
    }
  }, [myTeam]);

  // Handle PDF upload
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadingPdf(true);
    setUploadFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/teams/submission", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadFeedback({
          type: "error",
          text: data.error || "Failed to upload proof of work PDF.",
        });
      } else {
        setSubmission(data.submission);
        setSelectedFile(null);
        setUploadFeedback({
          type: "success",
          text: data.message || "Proof of Work PDF uploaded successfully!",
        });
      }
    } catch {
      setUploadFeedback({
        type: "error",
        text: "Network error occurred while uploading file.",
      });
    } finally {
      setUploadingPdf(false);
    }
  };

  // Live countdown timer logic
  useEffect(() => {
    if (!windowData || !windowData.isActive) {
      setCountdownText("Voting window inactive");
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(windowData.startsAt).getTime();
      const end = new Date(windowData.endsAt).getTime();

      if (now < start) {
        const diff = start - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownText(`Opens in ${days > 0 ? `${days}d ` : ""}${hours}h ${mins}m ${secs}s`);
      } else if (now >= start && now <= end) {
        const diff = end - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownText(`Closes in ${days > 0 ? `${days}d ` : ""}${hours}h ${mins}m ${secs}s`);
      } else {
        setCountdownText("Voting has ended");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [windowData]);

  const role = session?.user?.role || "VOTER";
  const isParticipant = role === "PARTICIPANT";
  const isAdmin = role === "ADMIN";
  const isVotingOpen = windowStatus === "active";

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="inline-flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md mb-3 border border-indigo-100">
            <Sparkles className="w-3.5 h-3.5" />
            <span></span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Welcome, {session?.user?.name || session?.user?.email?.split("@")[0]}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Role: <span className="font-semibold text-gray-800">{role}</span>
            {isParticipant && session?.user?.category && (
              <>
                {" "}
                • Category:{" "}
                <span className="font-semibold text-gray-800">
                  {session.user.category === "CS" ? "CS" : "Core"}
                </span>
                {" "}
                • Student ID:{" "}
                <span className="font-semibold text-gray-800">{session.user.studentId}</span>
              </>
            )}
          </p>
        </div>

        {/* Voting Window Countdown Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-gray-600">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>Voting Status</span>
            </div>
            {isVotingOpen ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                ● Live Open
              </span>
            ) : windowStatus === "upcoming" ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Scheduled
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                Closed
              </span>
            )}
          </div>

          <div className="text-lg font-bold text-gray-900 tracking-tight">
            {countdownText || "Calculating..."}
          </div>

          {windowData && (
            <div className="mt-2 pt-2 border-t border-gray-200 text-[11px] text-gray-500 space-y-0.5">
              <div className="flex justify-between">
                <span>Starts:</span>
                <span>{formatDate(windowData.startsAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ends:</span>
                <span>{formatDate(windowData.endsAt)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Participant Team Status Banner */}
      {isParticipant && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-900">Your Team Roster</h2>
            </div>
            {myTeam ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Registered
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-500" /> No Team Yet
              </span>
            )}
          </div>

          {myTeam ? (
            <div>
              <div className="mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Team Name
                </span>
                <p className="text-xl font-bold text-gray-900">{myTeam.name}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {myTeam.members.map((member, idx) => (
                  <div
                    key={member.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-gray-400">
                          Member {idx + 1}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            member.category === "CS"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {member.category === "CS" ? "CS" : "Core"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.studentId}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
              <div>
                <p className="text-sm text-gray-700">
                  You are currently unassigned. Form a team of 4 members (3 CS + 1 Core) to participate.
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Rule requirement: Exactly 3 Computer Science students + 1 Core student.
                </p>
              </div>
              <Link
                href="/teams/create"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-xs flex-shrink-0"
              >
                Create Team Now
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Proof of Work (PDF) Submission Section for Participant Squads */}
      {isParticipant && myTeam && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Proof of Work (PDF) Submission</h2>
                <p className="text-xs text-gray-500">
                  Submit 1 PDF file representing your squad's project deliverables. Voters will review this document to vote.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {isSubmissionOpen ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ● Submissions Open
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  ● Submissions Closed
                </span>
              )}
            </div>
          </div>

          {/* Upload Feedback */}
          {uploadFeedback && (
            <div
              className={`p-4 rounded-lg border flex items-center justify-between text-xs sm:text-sm ${
                uploadFeedback.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <div className="flex items-center space-x-2">
                {uploadFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                <span>{uploadFeedback.text}</span>
              </div>
              <button
                onClick={() => setUploadFeedback(null)}
                className="text-xs font-medium underline ml-4 hover:opacity-80"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Current Submission Card */}
          {submission ? (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                      Active Proof of Work (v{submission.submissionCount})
                    </span>
                    <span className="text-xs text-gray-500">
                      ({Math.round(submission.fileSize / 1024)} KB)
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>{submission.fileName}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    Submitted by: <strong>{submission.submitterName}</strong> ({submission.submitterEmail}
                    {submission.submitterStudentId ? ` • ${submission.submitterStudentId}` : ""}) on{" "}
                    <strong>{formatDate(submission.submittedAt)}</strong>
                  </div>
                </div>

                {/* View Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPdfModal(submission.pdfUrl)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    Preview PDF
                  </button>
                  <a
                    href={submission.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Open Tab
                  </a>
                </div>
              </div>

              {isSubmissionOpen && (
                <p className="text-[11px] text-indigo-700 pt-2 border-t border-indigo-100/60">
                  💡 <strong>Unlimited revisions:</strong> Any team member can upload a new PDF to replace this submission anytime before the admin closes submissions.
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Your team has not submitted a Proof of Work PDF yet. Please upload your project PDF document below so voters can review it.
              </span>
            </div>
          )}

          {/* Upload Form */}
          {isSubmissionOpen ? (
            <form onSubmit={handlePdfUpload} className="space-y-4 pt-2">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-400 transition bg-gray-50/50">
                <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <label className="cursor-pointer">
                  <span className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    Click to select PDF
                  </span>{" "}
                  <span className="text-xs text-gray-500">or drag and drop your document</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <p className="text-[11px] text-gray-400 mt-1">Single PDF file up to 15MB</p>

                {selectedFile && (
                  <div className="mt-3 inline-flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-800 font-medium">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>{selectedFile.name}</span>
                    <span className="text-gray-400 text-[11px]">
                      ({Math.round(selectedFile.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-gray-400 hover:text-red-500 ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!selectedFile || uploadingPdf}
                  className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {uploadingPdf ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Uploading PDF...
                    </>
                  ) : submission ? (
                    <>
                      <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                      Re-submit New PDF
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                      Submit Proof of Work
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
              🔒 Submissions are currently closed. The event administrators have locked submissions.
            </div>
          )}
        </div>
      )}

      {/* PDF Modal Preview */}
      {previewPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-bold truncate">
                  {myTeam?.name} — Proof of Work Preview
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={previewPdfModal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs font-medium rounded text-gray-200 transition"
                >
                  Open in New Tab
                </a>
                <button
                  onClick={() => setPreviewPdfModal(null)}
                  className="p-1 text-gray-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-gray-100 p-1">
              <iframe
                src={previewPdfModal}
                className="w-full h-full rounded border-0"
                title="Proof of Work PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Cast Votes */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition">
          <div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100">
              <Vote className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Cast Your Votes</h3>
            <p className="text-sm text-gray-500 mt-1">
              Explore teams and review their Proof of Work PDFs. Vote for your favorite squads during the active voting window.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/vote"
              className={`w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-medium transition shadow-xs ${
                isVotingOpen
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              {isVotingOpen ? "Go to Live Voting" : "View Teams & PDFs"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>

        {/* Card 2: Team Formation */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Team Management</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isParticipant
                ? myTeam
                  ? "Your team is fully formed and locked for the competition."
                  : "Assemble your 4-member squad with 3 CS and 1 Non-CS peers."
                : "Participant registration is required to create a team."}
            </p>
          </div>
          <div className="mt-6">
            {isParticipant ? (
              myTeam ? (
                <div className="w-full text-center py-2 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-200">
                  Team Locked & Ready
                </div>
              ) : (
                <Link
                  href="/teams/create"
                  className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-xs"
                >
                  Create Team
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              )
            ) : (
              <div className="w-full text-center py-2 text-xs text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                Participant Only Feature
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Admin Suite (for Admin) or Guidelines */}
        {isAdmin ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition">
            <div>
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4 border border-purple-100">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Admin Control Panel</h3>
              <p className="text-sm text-gray-500 mt-1">
                Manage submissions, schedule voting windows, monitor live leaderboard, and export results.
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/admin"
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-medium transition shadow-xs"
              >
                Open Admin Suite
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col justify-between hover:border-gray-300 transition">
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Event Guidelines</h3>
              <p className="text-sm text-gray-500 mt-1">
                Every voter can open and review each team's Proof of Work PDF before submitting their vote!
              </p>
            </div>
            <div className="mt-6 text-xs text-gray-400">
              Submit your team's Proof of Work PDF before the deadline closes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
