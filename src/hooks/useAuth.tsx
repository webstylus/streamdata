import {makeRedirectUri, revokeAsync, startAsync} from 'expo-auth-session';
import React, {useEffect, createContext, useContext, useState, ReactNode} from 'react';
import {generateRandom} from 'expo-auth-session/build/PKCE';

import {api} from '../services/api';
import {Alert} from "react-native";

interface User {
    id: number;
    display_name: string;
    email: string;
    profile_image_url: string;
}

interface AuthContextData {
    user: User;
    isLoggingOut: boolean;
    isLoggingIn: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

interface AuthProviderData {
    children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
    authorization: 'https://id.twitch.tv/oauth2/authorize',
    revocation: 'https://id.twitch.tv/oauth2/revoke'
};

interface AuthorizationProps {
    authentication: string
    errorCode: string
    params: {
        access_token: string
        token_type: string
        scope: string
        error: string
        error_description: string
        state: string
    }
    type: string
    url: string
}

function AuthProvider({children}: AuthProviderData) {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [user, setUser] = useState({} as User);
    const [userToken, setUserToken] = useState('');

    const {CLIENT_ID} = process.env

    async function signIn() {
        try {
            setIsLoggingIn(true)

            const REDIRECT_URI = makeRedirectUri({useProxy: true})
            const RESPONSE_TYPE = 'token'
            const SCOPE = encodeURI("openid user:read:email user:read:follows")
            const FORCE_VERIFY = true
            const STATE = generateRandom(30)
            const authUrl = `${twitchEndpoints.authorization}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}&force_verify=${FORCE_VERIFY}&state=${STATE}`
            const {params, type} = await startAsync({authUrl}) as AuthorizationProps
            if (type === 'success' && params.error === 'access_denied') {
                return Alert.alert('Falha no login', params.error_description)
            }
            if (params.state !== STATE) {
                return Alert.alert('Falha no login', 'O Token enviado ?? diferente do recebido.')
            }
            api.defaults.headers.authorization = `Bearer ${params.access_token}`

            const {data} = await api.get('/users')
            const [userInfo] = data.data
            setUser({
                id: userInfo.id,
                display_name: userInfo.display_name,
                email: userInfo.email,
                profile_image_url: userInfo.profile_image_url
            })
            setUserToken(params.access_token)
        } catch (error) {
            console.log(error)
            throw new Error('Ocorreu um erro ao tentar logar no app')
        } finally {
            setIsLoggingIn(false)
        }
    }

    async function signOut() {
        try {
            setIsLoggingIn(true)
            await revokeAsync(
                {token: userToken, clientId: CLIENT_ID},
                {revocationEndpoint: twitchEndpoints.revocation}
            )
        } catch (error) {
            console.log(error)
            throw new Error('Ocorreu um erro ao tentar se deslogar do app')
        } finally {
            setUser({} as User)
            setUserToken('')
            delete api.defaults.headers.authorization
            setIsLoggingIn(false)
        }
    }

    useEffect(() => {
        api.defaults.headers['Client-Id'] = CLIENT_ID;
    }, [])

    return (
        <AuthContext.Provider value={{user, isLoggingOut, isLoggingIn, signIn, signOut}}>
            {children}
        </AuthContext.Provider>
    )
}

function useAuth() {
    const context = useContext(AuthContext);

    return context;
}

export {AuthProvider, useAuth};
