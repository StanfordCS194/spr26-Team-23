"use client";

import { GeneratedPrompt, PromptCategory } from "@/types";
import { useState } from "react";

interface PromptGenerationPreviewProps {
  prompts: GeneratedPrompt[];
  onPromptsChange: (prompts: GeneratedPrompt[]) => void;
}

const CATEGORY_LABEL: Record<PromptCategory, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  use_case: "Use Case",
  niche: "Niche",
  purchase: "Purchase Intent",
};

const CATEGORIES: PromptCategory[] = ["discovery", "comparison", "use_case", "niche", "purchase"];

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
      <path d="M2.75 3.5c-.69 0-1.25.56-1.25 1.25v8.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V9.5a.75.75 0 0 0-1.5 0v3.75h-8.5V4.75H7A.75.75 0 0 0 7 3.5H2.75Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
    </svg>
  );
}

const selectClass =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";

const textareaClass =
  "w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100";

export function PromptGenerationPreview({ prompts, onPromptsChange }: PromptGenerationPreviewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ category: PromptCategory; prompt: string }>({
    category: "discovery",
    prompt: "",
  });
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<{ category: PromptCategory; prompt: string }>({
    category: "discovery",
    prompt: "",
  });

  const startEdit = (prompt: GeneratedPrompt) => {
    setEditingId(prompt.id);
    setEditDraft({ category: prompt.category, prompt: prompt.prompt });
  };

  const saveEdit = () => {
    if (!editingId || !editDraft.prompt.trim()) return;
    onPromptsChange(
      prompts.map((p) =>
        p.id === editingId
          ? { ...p, category: editDraft.category, prompt: editDraft.prompt.trim() }
          : p,
      ),
    );
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const deletePrompt = (id: string) => {
    if (editingId === id) setEditingId(null);
    onPromptsChange(prompts.filter((p) => p.id !== id));
  };

  const addPrompt = () => {
    if (!newDraft.prompt.trim()) return;
    const next: GeneratedPrompt = {
      id: `manual-${Date.now()}`,
      category: newDraft.category,
      prompt: newDraft.prompt.trim(),
      rationale: "",
    };
    onPromptsChange([...prompts, next]);
    setNewDraft({ category: "discovery", prompt: "" });
    setAdding(false);
  };

  const cancelAdd = () => {
    setAdding(false);
    setNewDraft({ category: "discovery", prompt: "" });
  };

  if (!prompts.length && !adding) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-950">Prompts</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Generate prompts above or add your own to get started.
            </p>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            + Add prompt
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-slate-950">Prompts</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Edit or remove any prompt, then run analysis when ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600">
            {prompts.length}
          </span>
          <button
            type="button"
            onClick={() => onPromptsChange([])}
            className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
        {prompts.map((prompt) =>
          editingId === prompt.id ? (
            <div key={prompt.id} className="space-y-3 py-4">
              <select
                value={editDraft.category}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, category: e.target.value as PromptCategory }))
                }
                className={selectClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <textarea
                className={`min-h-16 ${textareaClass}`}
                value={editDraft.prompt}
                onChange={(e) => setEditDraft((d) => ({ ...d, prompt: e.target.value }))}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={!editDraft.prompt.trim()}
                  className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={prompt.id} className="group py-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-700">
                  {CATEGORY_LABEL[prompt.category] ?? prompt.category}
                </span>
                <p className="min-w-0 flex-1 text-sm font-medium leading-6 text-slate-900">
                  {prompt.prompt}
                </p>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(prompt)}
                    title="Edit"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePrompt(prompt.id)}
                    title="Delete"
                    className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              {prompt.rationale ? (
                <p className="mt-2 text-sm leading-6 text-slate-500">{prompt.rationale}</p>
              ) : null}
            </div>
          ),
        )}
      </div>

      <div className="border-t border-slate-200 pt-4">
        {adding ? (
          <div className="space-y-3">
            <select
              value={newDraft.category}
              onChange={(e) =>
                setNewDraft((d) => ({ ...d, category: e.target.value as PromptCategory }))
              }
              className={selectClass}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <textarea
              className={`min-h-16 ${textareaClass}`}
              placeholder="Type your prompt..."
              value={newDraft.prompt}
              onChange={(e) => setNewDraft((d) => ({ ...d, prompt: e.target.value }))}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addPrompt();
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addPrompt}
                disabled={!newDraft.prompt.trim()}
                className="rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={cancelAdd}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            + Add prompt
          </button>
        )}
      </div>
    </section>
  );
}
