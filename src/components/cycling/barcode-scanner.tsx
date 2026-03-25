"use client"

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScanBarcode, Camera, X } from 'lucide-react'

interface Props {
  onScan: (barcode: string) => void
}

/**
 * Barcode scanner using the browser BarcodeDetector API (Chrome/Edge/Opera).
 * Falls back to manual entry if the API is not available.
 */
export function BarcodeScanner({ onScan }: Props) {
  const [open, setOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [hasApi, setHasApi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    // Check if BarcodeDetector is available
    setHasApi(typeof window !== 'undefined' && 'BarcodeDetector' in window)
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = 0
    }
    setIsScanning(false)
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsScanning(true)

      // Start detection loop
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'] })

      const detect = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue
            onScan(code)
            stopCamera()
            setOpen(false)
            return
          }
        } catch {
          // Detection frame error, continue
        }
        animFrameRef.current = requestAnimationFrame(detect)
      }
      animFrameRef.current = requestAnimationFrame(detect)
    } catch {
      setError('Impossible d\'acceder a la camera. Verifiez les permissions.')
      setIsScanning(false)
    }
  }, [onScan, stopCamera])

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) stopCamera()
  }

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim())
      setManualCode('')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="shrink-0" title="Scanner un code-barres">
          <ScanBarcode className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scanner un code-barres</DialogTitle>
          <DialogDescription>
            {hasApi
              ? 'Utilisez la camera pour scanner un code-barres EAN/UPC ou saisissez-le manuellement.'
              : 'Votre navigateur ne supporte pas le scan automatique. Saisissez le code manuellement.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera scanner */}
          {hasApi && (
            <div className="space-y-2">
              {isScanning ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg bg-black aspect-video"
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-2/3 h-1/2 border-2 border-primary/60 rounded-lg" />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={stopCamera}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={startCamera}
                >
                  <Camera className="w-4 h-4" /> Ouvrir la camera
                </Button>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {/* Manual entry */}
          <div className="flex gap-2">
            <Input
              placeholder="Saisir le code-barres..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            />
            <Button type="button" onClick={handleManualSubmit} disabled={!manualCode.trim()}>
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
