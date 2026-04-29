interface RawResponseViewerProps {
  response: string;
}

export function RawResponseViewer({ response }: RawResponseViewerProps) {
  return (
    <div className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
      {response}
    </div>
  );
}
