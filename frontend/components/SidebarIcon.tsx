export function SidebarIcon({
  code,
}: {
  code: string;
}) {
  const base =
    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-gray-900 border border-gray-700";

  return (
    <div className={base}>
      {code}
    </div>
  );
}
