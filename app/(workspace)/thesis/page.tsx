import { ThesisForm } from '@/components/workspace/thesis-form'

export default function ThesisPage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-sans text-xl font-semibold text-foreground">New thesis</h1>
        <p className="font-mono text-[10px] text-muted-foreground tracking-wide uppercase mt-0.5">
          Define your investment criteria
        </p>
      </div>
      <ThesisForm />
    </div>
  )
}
