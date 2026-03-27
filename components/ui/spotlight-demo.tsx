import { GlowCard } from "@/components/ui/spotlight-card";

export function Default() {
  return (
    <div className="w-screen h-screen flex flex-row items-center justify-center gap-10 custom-cursor">
      <GlowCard>
        <div className="p-4 text-white">Card 1</div>
      </GlowCard>
      <GlowCard>
        <div className="p-4 text-white">Card 2</div>
      </GlowCard>
      <GlowCard>
        <div className="p-4 text-white">Card 3</div>
      </GlowCard>
    </div>
  );
}
