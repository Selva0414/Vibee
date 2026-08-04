import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../components/Icon';

// Use appropriate local IP or deployed backend URL
const BACKEND_URL = 'http://localhost:5000/api/auth';
// NOTE: 192.168.1.100 is just an example. Please replace it with the exact IPv4 of your machine if running on a physical device, or localhost if on web/emulator.

export default function SignupScreen({ onSignupSuccess, onNavigateToLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    // Request permission (mostly for iOS/Android, works on web without asking)
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setProfilePhoto(base64Image);
    }
  };

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email.toLowerCase(), password, profilePhoto })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      await AsyncStorage.setItem('@user_token', data.token);
      await AsyncStorage.setItem('@user_info', JSON.stringify(data.user));
      
      onSignupSuccess();
    } catch (error) {
      Alert.alert('Signup Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../logo.png.png')} 
            style={styles.iconCircle} 
          />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.inputBox}>
            <Icon name="person" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />
          </View>

          <TouchableOpacity style={styles.inputBox} onPress={pickImage}>
            <Icon name="person" size={20} color="#94A3B8" style={styles.inputIcon} />
            <Text style={[styles.input, { color: profilePhoto ? '#FFF' : '#94A3B8' }]}>
              {profilePhoto ? 'Profile Photo Selected' : 'Tap to Upload Profile Photo'}
            </Text>
            {profilePhoto && (
              <Image source={{ uri: profilePhoto }} style={{ width: 30, height: 30, borderRadius: 15 }} />
            )}
          </TouchableOpacity>

          <View style={styles.inputBox}>
            <Icon name="mail" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.inputBox}>
            <Icon name="lock-closed" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={styles.signupBtn}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.signupBtnText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={onNavigateToLogin}>
            <Text style={styles.footerLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, marginBottom: 24, resizeMode: 'cover', borderWidth: 2, borderColor: '#9B5DE5' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9CA3AF' },
  inputContainer: { gap: 16 },
  inputBox: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 12, height: 56, alignItems: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: '#333' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#FFF', fontSize: 16 },
  signupBtn: { backgroundColor: '#9B5DE5', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  signupBtnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: '#9CA3AF', fontSize: 15 },
  footerLink: { color: '#9B5DE5', fontSize: 15, fontWeight: 'bold' }
});
