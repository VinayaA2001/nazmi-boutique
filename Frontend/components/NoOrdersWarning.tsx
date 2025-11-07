import { ArrowLeft, X } from "lucide-react";

export default function NoOrdersWarning({setShowPaymentModal}){
    return (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm overflow-y-auto">
        <div className="min-h-full flex items-start justify-center p-4 sm:pt-8">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl">
            <div className="p-6">
              {/* Top bar with Back */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setShowPaymentModal(false)} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="w-4 h-4" />
                  Back to product
                </button>
                <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Sorry! we are not taking any oders through website now!</h3>
                <p className="text-sm text-gray-500">Please try again after few days.</p>

                <button 
                  className="w-fit mx-auto mt-4 bg-black text-white py-4 px-10 rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center justify-center gap-3 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
}