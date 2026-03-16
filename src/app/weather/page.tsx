"use client"

import React, { useState } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  CloudSun, 
  Wind, 
  Thermometer, 
  Clock, 
  AlertTriangle, 
  Loader2,
  CheckCircle2,
  Sparkles,
  MapPin,
  Search,
  Navigation,
  CalendarIcon,
  Timer
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { cyclingOutfitRecommendation, type CyclingOutfitRecommendationOutput } from '@/ai/flows/cycling-outfit-recommendation-flow'
import { useToast } from '@/hooks/use-toast'

// Mock Inventory Data
const CLOTHING_INVENTORY = [
  { name: "Maillot thermique Castelli", type: "jersey", temperatureRangeCelsius: "5-15°C", windproof: false, waterproof: false, layer: "mid" },
  { name: "Gilet coupe-vent Rapha", type: "jacket", temperatureRangeCelsius: "8-18°C", windproof: true, waterproof: false, layer: "outer" },
  { name: "Veste Gore-Tex Shakedry", type: "jacket", temperatureRangeCelsius: "5-12°C", windproof: true, waterproof: true, layer: "outer" },
  { name: "Cuissard long hiver Specialized", type: "tights", temperatureRangeCelsius: "0-10°C", windproof: true, waterproof: false, layer: "outer" },
  { name: "Base layer Mérinos", type: "baselayer", temperatureRangeCelsius: "-5-15°C", windproof: false, waterproof: false, layer: "base" },
  { name: "Gants néoprène", type: "gloves", temperatureRangeCelsius: "2-10°C", windproof: true, waterproof: true, layer: "outer" },
  { name: "Couvre-chaussures Castelli", type: "shoe covers", temperatureRangeCelsius: "0-10°C", windproof: true, waterproof: true, layer: "outer" }
]

export default function WeatherAssistant() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [result, setResult] = useState<CyclingOutfitRecommendationOutput | null>(null)
  
  const [location, setLocation] = useState('')
  const [date, setDate] = useState<Date>(new Date())
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState(2)

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Géolocalisation non supportée",
        description: "Votre navigateur ne supporte pas la géolocalisation.",
      })
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        toast({
          title: "Position récupérée",
          description: "Coordonnées GPS identifiées.",
        })
        setGeoLoading(false)
      },
      (error) => {
        setGeoLoading(false)
        toast({
          variant: "destructive",
          title: "Erreur de localisation",
          description: "Impossible d'accéder à votre position.",
        })
      }
    )
  }

  const handleGetRecommendation = async () => {
    if (!location) {
      toast({
        variant: "destructive",
        title: "Lieu manquant",
        description: "Veuillez entrer une destination ou vous géolocaliser.",
      })
      return
    }

    setLoading(true)
    try {
      // Combine date and time
      const dateTimeStr = format(date, 'yyyy-MM-dd') + 'T' + time + ':00'
      
      const recommendation = await cyclingOutfitRecommendation({
        location: location,
        dateTime: dateTimeStr,
        durationHours: duration,
        clothingInventory: CLOTHING_INVENTORY
      })
      setResult(recommendation)
    } catch (error) {
      console.error("Recommendation failed", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "L'IA n'a pas pu analyser les conditions.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 space-y-2">
          <Badge variant="outline" className="text-accent border-accent/30 gap-1 bg-accent/5 px-3">
            <Sparkles className="w-3 h-3" /> Assistant Prédictif
          </Badge>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CloudSun className="w-10 h-10 text-primary" /> Assistant Météo & Tenue
          </h1>
          <p className="text-muted-foreground">Prévoyez votre sortie et laissez l'IA déduire la météo et préparer votre équipement.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Card className="lg:col-span-4 bg-card/40 border-border h-fit">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-4 h-4" /> Planifier la sortie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="location">Lieu de départ</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input 
                      id="location"
                      placeholder="ex: Mont Ventoux" 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleGeolocation}
                    disabled={geoLoading}
                    className="shrink-0"
                  >
                    {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Date du départ</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP", { locale: fr }) : <span>Choisir une date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-muted-foreground" /> Heure
                    </Label>
                    <Input 
                      type="time" 
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" /> Durée (h)
                    </Label>
                    <Input 
                      type="number" 
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      min={1}
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleGetRecommendation} 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Détails de la sortie
              </Button>
            </CardContent>
          </Card>

          <div className="lg:col-span-8 space-y-6">
            {!result && !loading && (
              <div className="h-full min-h-[450px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl bg-card/20">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <CloudSun className="w-12 h-12 text-muted-foreground opacity-20" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Analyse prédictive</h3>
                <p className="text-muted-foreground max-w-xs">Indiquez quand et où vous roulez. L'IA consultera les historiques et prévisions pour vous conseiller.</p>
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[450px] flex flex-col items-center justify-center text-center p-8 bg-card/20 rounded-xl">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground font-medium">L'IA déduit les conditions à {location}...</p>
                <p className="text-xs text-muted-foreground mt-2 italic">Analyse du climat pour le {format(date, "dd/MM")} à {time}...</p>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <Card className="bg-card/40 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                        <Thermometer className="w-3 h-3 text-accent" /> Temp. Estimée
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{result.predictedWeather.temperatureCelsius}°C</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/40 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                        <Wind className="w-3 h-3 text-accent" /> Vent Prévu
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{result.predictedWeather.windSpeedKmh} <span className="text-sm">km/h</span></div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card/40 border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
                        <CloudSun className="w-3 h-3 text-accent" /> Conditions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold truncate">{result.predictedWeather.conditions}</div>
                    </CardContent>
                  </Card>
                </section>

                <Card className="bg-card/60 border-accent/20 border-2 overflow-hidden shadow-xl">
                  <div className="bg-accent/10 px-6 py-3 border-b border-accent/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-accent uppercase tracking-widest">Analyse LifeCycle Pro</span>
                    <Badge variant="secondary" className="text-[10px]">Date: {format(date, "dd MMM", { locale: fr })}</Badge>
                  </div>
                  <CardContent className="pt-6 space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-tighter flex items-center gap-2">
                         Bulletin Météo
                      </h3>
                      <p className="text-sm italic leading-relaxed text-foreground">
                        {result.predictedWeather.summary}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-tighter flex items-center gap-2">
                         Conseil Tenue
                      </h3>
                      <div className="bg-background/80 p-5 rounded-xl text-sm leading-relaxed border border-border shadow-inner whitespace-pre-wrap">
                        {result.recommendation}
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-accent" /> Liste à préparer :
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {result.recommendedItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl group hover:border-accent transition-all">
                            <div className="w-2 h-2 rounded-full bg-accent group-hover:scale-125 transition-transform" />
                            <span className="text-sm font-medium">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-500/5 border-yellow-500/20">
                  <CardContent className="pt-6 flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">Note de l'IA</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cette météo est une estimation basée sur les données historiques de {location} pour cette période. Vérifiez les prévisions réelles 1h avant le départ.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}