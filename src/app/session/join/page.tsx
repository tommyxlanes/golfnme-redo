"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Flag, Check, AlertCircle } from "lucide-react";

function JoinSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCode = searchParams.get("code");

  const [code, setCode] = useState(prefilledCode || "");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const codeArray = code.toUpperCase().split("").slice(0, 6);

  useEffect(() => {
    if (prefilledCode && prefilledCode.length === 6) handleJoin();
  }, [prefilledCode]);

  const handleInputChange = (index: number, value: string) => {
    const char = value.toUpperCase().slice(-1);
    const newCode = codeArray.slice();

    if (char) {
      newCode[index] = char;
      setCode(newCode.join(""));

      if (index < 5) inputRefs.current[index + 1]?.focus();
    }

    setError("");
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !codeArray[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const sliced = pasted.slice(0, 6);
    setCode(sliced);

    if (sliced.length === 6) inputRefs.current[5]?.focus();
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      setError("Please enter a 6-character invite code.");
      return;
    }

    setIsJoining(true);
    setError("");

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/session/${code}`);
      } else {
        setError(data.error || "Unable to join session.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gold-gradient text-fairway-900">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <h1 className="font-display text-2xl font-bold">Join Session</h1>
              <p className="text-fairway-700/70 text-sm">
                Enter your invite code
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-gold-100 mx-auto mb-4 flex items-center justify-center">
            <Users className="w-10 h-10 text-gold-600" />
          </div>

          <h2 className="font-display text-xl font-semibold text-sand-900">
            Enter Invite Code
          </h2>
          <p className="text-sand-600 mt-2">
            Your friend will share a 6-character code
          </p>
        </div>

        {/* Code Input Boxes */}
        <div className="flex justify-center gap-2 mb-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              maxLength={1}
              value={codeArray[i] || ""}
              onChange={(e) => handleInputChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`w-12 h-14 text-center text-2xl font-mono font-bold rounded-xl border-2 transition-all ${
                error
                  ? "border-red-300 bg-red-50"
                  : codeArray[i]
                  ? "border-gold-500 bg-gold-50 text-gold-700"
                  : "border-sand-200 bg-white focus:border-gold-500"
              }`}
            />
          ))}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 text-red-600 mb-6"
          >
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </motion.div>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoin}
          disabled={code.length !== 6 || isJoining}
          className="btn btn-gold w-full py-4 disabled:opacity-50"
        >
          {isJoining ? (
            <span className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-fairway-900/30 border-t-fairway-900 rounded-full"
              />
              Joining...
            </span>
          ) : (
            <>
              <Flag className="w-5 h-5" />
              Join Session
            </>
          )}
        </button>

        <p className="text-center text-sand-500 text-sm mt-6">
          Don’t have a code?{" "}
          <button
            onClick={() => router.push("/session/new")}
            className="text-gold-600 hover:underline font-medium"
          >
            Create a session
          </button>
        </p>
      </main>
    </div>
  );
}

export default function JoinSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-gold-200 border-t-gold-500 rounded-full"
          />
        </div>
      }
    >
      <JoinSessionContent />
    </Suspense>
  );
}

// 'use client'

// import { useState, useEffect, useRef, Suspense } from 'react'
// import { useRouter, useSearchParams } from 'next/navigation'
// import { motion } from 'framer-motion'
// import {
//   ArrowLeft,
//   Users,
//   Flag,
//   Check,
//   AlertCircle,
// } from 'lucide-react'

// function JoinSessionContent() {
//   const router = useRouter()
//   const searchParams = useSearchParams()
//   const prefilledCode = searchParams.get('code')

//   const [code, setCode] = useState(prefilledCode || '')
//   const [isJoining, setIsJoining] = useState(false)
//   const [error, setError] = useState('')
//   const inputRefs = useRef<(HTMLInputElement | null)[]>([])

//   // Split code into array for individual inputs
//   const codeArray = code.toUpperCase().split('').slice(0, 6)

//   useEffect(() => {
//     // Auto-submit if we have a prefilled code
//     if (prefilledCode && prefilledCode.length === 6) {
//       handleJoin()
//     }
//   }, [prefilledCode])

//   const handleInputChange = (index: number, value: string) => {
//     const char = value.toUpperCase().slice(-1)
//     const newCode = codeArray.slice()

//     if (char) {
//       newCode[index] = char
//       setCode(newCode.join(''))

//       // Auto-focus next input
//       if (index < 5 && inputRefs.current[index + 1]) {
//         inputRefs.current[index + 1]?.focus()
//       }
//     }

//     setError('')
//   }

//   const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
//     if (e.key === 'Backspace' && !codeArray[index] && index > 0) {
//       inputRefs.current[index - 1]?.focus()
//     }
//   }

//   const handlePaste = (e: React.ClipboardEvent) => {
//     e.preventDefault()
//     const pastedCode = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
//     setCode(pastedCode)

//     if (pastedCode.length === 6) {
//       inputRefs.current[5]?.focus()
//     }
//   }

//   const handleJoin = async () => {
//     if (code.length !== 6) {
//       setError('Please enter a valid 6-character code')
//       return
//     }

//     setIsJoining(true)
//     setError('')

//     try {
//       const response = await fetch('/api/sessions/join', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ inviteCode: code }),
//       })

//       const data = await response.json()

//       if (data.success) {
//         router.push(`/session/${code}`)
//       } else {
//         setError(data.error || 'Session not found or no longer available')
//       }
//     } catch (err) {
//       setError('Failed to join session. Please try again.')
//     } finally {
//       setIsJoining(false)
//     }
//   }

//   return (
//     <div className="min-h-screen bg-slate-50">
//       {/* Header */}
//       <header className="bg-gold-gradient text-fairway-900">
//         <div className="max-w-3xl mx-auto px-4 py-6">
//           <div className="flex items-center gap-4">
//             <button
//               onClick={() => router.back()}
//               className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
//             >
//               <ArrowLeft className="w-5 h-5" />
//             </button>
//             <div>
//               <h1 className="font-display text-2xl font-bold">Join Session</h1>
//               <p className="text-fairway-700/70 text-sm">Enter your invite code</p>
//             </div>
//           </div>
//         </div>
//       </header>

//       <main className="max-w-3xl mx-auto px-4 py-12">
//         <div className="text-center mb-8">
//           <div className="w-20 h-20 rounded-full bg-gold-100 mx-auto mb-4 flex items-center justify-center">
//             <Users className="w-10 h-10 text-gold-600" />
//           </div>
//           <h2 className="font-display text-xl font-semibold text-sand-900">
//             Enter Invite Code
//           </h2>
//           <p className="text-sand-600 mt-2">
//             Ask your friend for the 6-character code
//           </p>
//         </div>

//         {/* Code Input */}
//         <div className="flex justify-center gap-2 mb-6">
//           {[0, 1, 2, 3, 4, 5].map((index) => (
//             <input
//               key={index}
//               ref={(el) => { inputRefs.current[index] = el }}
//               type="text"
//               maxLength={1}
//               value={codeArray[index] || ''}
//               onChange={(e) => handleInputChange(index, e.target.value)}
//               onKeyDown={(e) => handleKeyDown(index, e)}
//               onPaste={handlePaste}
//               className={`w-12 h-14 text-center text-2xl font-mono font-bold rounded-xl border-2 transition-all outline-none ${
//                 error
//                   ? 'border-red-300 bg-red-50'
//                   : codeArray[index]
//                     ? 'border-gold-500 bg-gold-50 text-gold-700'
//                     : 'border-sand-200 bg-white focus:border-gold-500'
//               }`}
//             />
//           ))}
//         </div>

//         {/* Error Message */}
//         {error && (
//           <motion.div
//             initial={{ opacity: 0, y: -10 }}
//             animate={{ opacity: 1, y: 0 }}
//             className="flex items-center justify-center gap-2 text-red-600 mb-6"
//           >
//             <AlertCircle className="w-5 h-5" />
//             <span className="text-sm">{error}</span>
//           </motion.div>
//         )}

//         {/* Join Button */}
//         <button
//           onClick={handleJoin}
//           disabled={code.length !== 6 || isJoining}
//           className="btn btn-gold w-full py-4 disabled:opacity-50"
//         >
//           {isJoining ? (
//             <span className="flex items-center justify-center gap-2">
//               <motion.div
//                 animate={{ rotate: 360 }}
//                 transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
//                 className="w-5 h-5 border-2 border-fairway-900/30 border-t-fairway-900 rounded-full"
//               />
//               Joining...
//             </span>
//           ) : (
//             <>
//               <Flag className="w-5 h-5" />
//               Join Session
//             </>
//           )}
//         </button>

//         {/* Help Text */}
//         <p className="text-center text-sand-500 text-sm mt-6">
//           Don't have a code?{' '}
//           <button
//             onClick={() => router.push('/session/new')}
//             className="text-gold-600 font-medium hover:underline"
//           >
//             Create your own session
//           </button>
//         </p>
//       </main>
//     </div>
//   )
// }

// export default function JoinSessionPage() {
//   return (
//     <Suspense fallback={
//       <div className="min-h-screen bg-slate-50 flex items-center justify-center">
//         <motion.div
//           animate={{ rotate: 360 }}
//           transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
//           className="w-12 h-12 border-4 border-gold-200 border-t-gold-500 rounded-full"
//         />
//       </div>
//     }>
//       <JoinSessionContent />
//     </Suspense>
//   )
// }
