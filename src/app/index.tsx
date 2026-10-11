import { Redirect } from 'expo-router';

/** Punto de entrada: por ahora siempre lleva al login. */
export default function Index() {
  return <Redirect href="/login" />;
}