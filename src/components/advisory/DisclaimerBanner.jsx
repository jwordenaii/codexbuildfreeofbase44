export default function DisclaimerBanner() {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 px-6 py-4 rounded-r-lg">
      <div className="flex items-start gap-3">
        <span className="text-yellow-500 text-xl flex-shrink-0 mt-0.5" aria-hidden="true">
          ⚠️
        </span>
        <div>
          <p className="font-bold text-yellow-800 text-sm">
            Advisory Reference Only — Not Legal Advice
          </p>
          <p className="text-yellow-700 text-sm mt-1 leading-relaxed">
            This information is provided for general reference purposes only. Laws, regulations, and
            code requirements change frequently. Always verify current requirements with the
            applicable state agency, and consult a licensed attorney in the relevant jurisdiction
            before making legal or compliance decisions. J. Worden &amp; Sons makes no
            representations regarding accuracy or completeness.
          </p>
        </div>
      </div>
    </div>
  )
}
