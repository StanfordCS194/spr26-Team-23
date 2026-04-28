interface RawResponseViewerProps {
  response: string;
}

export function RawResponseViewer({ response }: RawResponseViewerProps) {
  return (
    <div className="mt-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-lg text-blue-50">
      {response}
    </div>
  );
}
