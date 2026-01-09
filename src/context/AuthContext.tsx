import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '../services/types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = useCallback(async (id: string, email: string) => {
        try {
            console.log('🔍 Fetching profile for user:', id);
            
            // Timeout de 2 segundos para la query
            const queryPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile query timeout')), 2000)
            );

            const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

            console.log('📦 Profile query response:', { data, error });

            if (error || !data) {
                console.log('⚠️ Profile not found, creating...', error?.message);
                const name = email.split('@')[0];
                const newProfile = {
                    id,
                    email,
                    full_name: name,
                    avatar_url: `https://ui-avatars.com/api/?name=${name}&background=random`,
                    dni_verified: false
                };
                
                console.log('📝 Inserting profile:', newProfile);
                
                const insertPromise = supabase
                    .from('profiles')
                    .insert([newProfile])
                    .select()
                    .single();

                const insertTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Profile insert timeout')), 2000)
                );

                try {
                    const { data: created, error: createError } = await Promise.race([insertPromise, insertTimeout]) as any;
                    console.log('📦 Insert response:', { created, createError });

                    if (!createError && created) {
                        console.log('✅ Profile created:', created);
                        setUser(created);
                    } else {
                        console.log('❌ Insert failed, using fallback user');
                        setUser({ id, email, full_name: name });
                    }
                } catch (insertErr) {
                    console.log('⏱️ Insert timed out, using fallback user');
                    setUser({ id, email, full_name: name });
                }
            } else if (data) {
                console.log('✅ Profile found:', data);
                setUser(data);
            }
        } catch (error: any) {
            console.error('❌ fetchProfile error:', error?.message);
            // Fallback: crear usuario mínimo para que el login funcione
            const name = email.split('@')[0];
            console.log('✅ Using fallback user (error):', { id, email, full_name: name });
            setUser({ id, email, full_name: name });
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const safetyTimer = setTimeout(() => {
            if (mounted) {
                console.warn('⏱️ Auth initialization timeout (3s), forcing completion.');
                setLoading(false);
            }
        }, 3000);

        const initializeAuth = async () => {
            try {
                console.log('🔐 Initializing authentication...');
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error('❌ Error getting session:', error);
                } else if (session?.user) {
                    console.log('✅ Session found for user:', session.user.email);
                    if (mounted) {
                        await fetchProfile(session.user.id, session.user.email || `user_${session.user.id}@buynt.com`);
                    }
                } else {
                    console.log('ℹ️ No active session found');
                }
            } catch (error) {
                console.error('❌ Error checking auth session:', error);
            } finally {
                if (mounted) {
                    console.log('✅ Auth initialization complete');
                    setLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            console.log('🔔 Auth state change event:', event, 'user:', session?.user?.email);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                console.log('👤 User signed in/token refreshed');
                if (session?.user) {
                    await fetchProfile(session.user.id, session.user.email || `user_${session.user.id}@buynt.com`);
                }
                // IMPORTANTE: Siempre poner loading a false cuando se completa auth
                if (mounted) setLoading(false);
            } else if (event === 'SIGNED_OUT') {
                console.log('👋 User signed out');
                if (mounted) {
                    setUser(null);
                    setLoading(false);
                }
            }
        });

        return () => {
            mounted = false;
            clearTimeout(safetyTimer);
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    const refreshUser = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await fetchProfile(session.user.id, session.user.email || '');
            }
        } catch (error) {
            console.error('Error refreshing user:', error);
        }
    }, [fetchProfile]);

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('❌ Sign out error:', error);
            throw error;
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOut, isAuthenticated: !!user, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
