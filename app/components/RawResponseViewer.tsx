interface RawResponseViewerProps {
  response: string;
}

export function RawResponseViewer({ response }: RawResponseViewerProps) {
  return (
    <div className="mt-3 whitespace-pre-wrap rounded-lg border border-blue-500/30 bg-slate-900/70 p-4 text-base leading-relaxed text-blue-50">
      {response}
    </div>
  );
}
