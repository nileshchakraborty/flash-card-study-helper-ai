console.log('[App.tsx] Importing gesture handler...');
import 'react-native-gesture-handler';
console.log('[App.tsx] Importing dependencies...');
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { StudyScreen } from './src/screens/StudyScreen';
import { theme } from './src/theme';
console.log('[App.tsx] All imports loaded');

console.log('[App.tsx] Creating Stack Navigator...');
const Stack = createNativeStackNavigator();
console.log('[App.tsx] Stack Navigator created');

export default function App() {
  console.log('[App.tsx] App component rendering...');
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Study" component={StudyScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
