import { StressLab } from "@/components/finance/stress-lab";

export default function StressPage() {
  return (
    <div>
      <h1 className="text-4xl">Financial stress testing</h1>
      <div className="mt-4"><StressLab /></div>
    </div>
  );
}
