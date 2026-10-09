import { type ArtifactDef, bookNote } from "@dingze/shared";

/** 书中方法 for one artifact: the checklist row plus the book's points, pitfalls and 定版门禁. */
export function BookMethod({ def }: { def: ArtifactDef }) {
  const note = bookNote(def.code);
  return (
    <div className="mt-2 flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="opacity-70">工作任务</dt>
        <dd>{def.task}</dd>
        <dt className="opacity-70">实施步骤</dt>
        <dd>{def.step}</dd>
        <dt className="opacity-70">工具 / 成果</dt>
        <dd>{def.bookRef}</dd>
      </dl>
      {note ? (
        <>
          <section>
            <h4 className="text-xs font-semibold opacity-80">要点</h4>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {note.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="text-xs font-semibold opacity-80">常见的坑</h4>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {note.pitfalls.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="text-xs font-semibold opacity-80">定版门禁</h4>
            <p className="mt-1">{note.gate}</p>
          </section>
          <p className="text-xs opacity-70">出处：{note.ref}</p>
        </>
      ) : null}
    </div>
  );
}
