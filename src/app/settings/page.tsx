"use client";

import React, { useState, useEffect } from 'react';
import { AppNavigation } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ShieldCheck, ExternalLink, Save, Loader2, Key, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function SettingsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const settingsRef = useMemoFirebase(() => {
    if (!user || !db) return null
    return doc(db, `users/${user.uid}/settings/intervals`)
  }, [db, user])
  const { data: settings, isLoading: loadingSettings } = useDoc(settingsRef);

  const [athleteId, setAthleteId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setAthleteId(settings.intervalsAthleteId || '');
      setApiKey(settings.intervalsApiKey || '');
    }
  }, [settings]);

  const handleSave = async () => {
    if (!user || !db) return;

    setSaving(true);
    const settingsData = {
      intervalsAthleteId: athleteId,
      intervalsApiKey: apiKey,
    };

    const settingsRef = doc(db, `users/${user.uid}/settings/intervals`);
    
    setDoc(settingsRef, settingsData)
      .then(() => {
        toast({
          title: "Paramètres enregistrés",
          description: "Vos identifiants Intervals.icu sont à jour.",
        });
      })
      .catch(async (err) => {
        const permissionError = new FirestorePermissionError({
          path: settingsRef.path,
          operation: 'update',
          requestResourceData: settingsData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0">
          <h1 className="text-4xl font-bold tracking-tighter text-gradient">Réglages</h1>
          <p className="text-muted-foreground">Personnalisez votre expérience LifeCycle Pro.</p>
        </header>

        <Card className="apple-card border-none shadow-2xl">
          <CardHeader className="pb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/5 rounded-[18px] text-primary">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Intégration Intervals.icu</CardTitle>
                  <CardDescription>Synchronisation des données de performance.</CardDescription>
                </div>
              </div>
              {settings?.intervalsAthleteId && (
                <Badge className="rounded-full bg-green-500/10 text-green-600 border-none px-4">Connecté</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="p-6 bg-muted/30 rounded-[24px] border border-border/40 flex items-start gap-4">
              <div className="text-sm space-y-3">
                <p className="font-bold text-foreground">Besoin d'aide ?</p>
                <p className="text-muted-foreground leading-relaxed">
                  L'ID Athlète et la Clé API se trouvent dans vos paramètres Intervals.icu, tout en bas de la page.
                </p>
                <a 
                  href="https://intervals.icu/settings" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary font-bold hover:underline gap-1 text-xs"
                >
                  Aller sur Intervals.icu <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="space-y-3">
                <Label htmlFor="athleteId" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                  <User className="w-3 h-3" /> ID Athlète
                </Label>
                <Input 
                  id="athleteId"
                  placeholder="ex: i12345" 
                  value={athleteId}
                  onChange={(e) => setAthleteId(e.target.value)}
                  className="rounded-2xl h-14 bg-background border-border/40 focus:ring-primary"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="apiKey" className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                  <Key className="w-3 h-3" /> Clé API
                </Label>
                <Input 
                  id="apiKey"
                  type="password"
                  placeholder="Clé secrète" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="rounded-2xl h-14 bg-background border-border/40 focus:ring-primary"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="px-8 py-6 bg-muted/10 border-t border-border/40 flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={saving || loadingSettings || !user}
              className="rounded-full px-10 h-12 bg-primary text-white font-bold hover:shadow-xl shadow-primary/20 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
