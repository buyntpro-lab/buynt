import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { User } from '../services/types';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Safety timer: Force loading to false if it takes too long (3s)
        // This prevents the "infinite spinner" issue if Supabase hangs or fails silently.
        const safetyTimer = setTimeout(() => {
            if (mounted) {
                setLoading((prev) => {
                    if (prev) console.warn('Auth initialization timed out, forcing completion.');
                    return false;
                });
            }
        }, 3000);

        const fetchProfile = async (id: string, email: string) => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (!mounted) return;

                if (error) {
                    // If error (table doesn't exist, record not found, etc.), create profile or use fallback
                    console.log('Profile fetch error, attempting to create profile:', error.code);
                    const name = email.split('@')[0];
                    const newProfile = {
                        id,
                        email,
                        full_name: name,
                        avatar_url: `https://ui-avatars.com/api/?name=${name}&background=random`,
                        dni_verified: false
                    };
                    
                    try {
                        const { data: created, error: createError } = await supabase
                            .from('profiles')
                            .insert([newProfile])
                            .select()
                            .single();

                        if (createError) {
                            console.error('Failed to create profile:', createError);
                            throw createError;
                        }
                        if (!mounted) return;
                        setUser(created);
                    } catch (insertError) {
                        // If profile creation also fails, use minimal user
                        console.error('Profile creation failed, using minimal user:', insertError);
                        if (mounted) setUser({ id, email, full_name: name });
                    }
                } else if (data) {
                    setUser(data);
                } else {
                    // Fallback if no data and no error
                    setUser({ id, email, full_name: email.split('@')[0] });
                }
            } catch (error) {
                console.error('Error in fetchProfile:', error);
                // Fallback to minimal user to allow login even if profile fetch fails
                if (mounted) setUser({ id, email, full_name: email.split('@')[0] });
            }
        };

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (mounted && session?.user) {
                    await fetchProfile(session.user.id, session.user.email || `user_${session.user.id}@buynt.com`);
                }
            } catch (error) {
                console.error('Error checking auth session:', error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) {
                    await fetchProfile(session.user.id, session.user.email || `user_${session.user.id}@buynt.com`);
                    if (mounted) setLoading(false);
                }
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
            clearTimeout(safetyTimer);
            subscription.unsubscribe();
        };
    }, []);

    // Helper removed from usage outside effect to keep it clean, 
    // or we can define it outside if we want other functions to use it, 
    // but primarily it's for internal state sync.
    // For manual updates, we can re-fetch if needed, but for now this is sufficient.

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOut, isAuthenticated: !!user }}>
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
