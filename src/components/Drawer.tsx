import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Easing,
  TouchableWithoutFeedback,
} from 'react-native';

// Sheet styling matches the home CupSheet: white, 24px top corners, a light
// warm scrim, deceleration-only motion (no spring, so no overshoot).
const EASE_OUT = Easing.bezier(0.16, 0.9, 0.4, 1);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 50;
const HANDLE_HEIGHT = 40; // Height of the handle area

interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  fullScreen?: boolean;
}

export const Drawer: React.FC<DrawerProps> = ({
  visible,
  onClose,
  children,
  fullScreen = false,
}) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(0);
  const [isGestureFromHandle, setIsGestureFromHandle] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 550, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(scrim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 300, useNativeDriver: true }),
        Animated.timing(scrim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // PanResponder for the handle only
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to downward swipes
        return gestureState.dy > 5;
      },
      onPanResponderGrant: () => {
        setIsGestureFromHandle(true);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragOffset.current = gestureState.dy;
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsGestureFromHandle(false);
        if (gestureState.dy > SWIPE_THRESHOLD) {
          // Swipe down threshold exceeded, close drawer
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            dragOffset.current = 0;
            onClose();
          });
        } else {
          // Settle back to the open position
          Animated.timing(translateY, {
            toValue: 0,
            duration: 400,
            easing: EASE_OUT,
            useNativeDriver: true,
          }).start(() => {
            dragOffset.current = 0;
          });
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: scrim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.drawer,
          fullScreen && styles.fullScreen,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Swipe indicator - only this area responds to gestures */}
        <View
          style={styles.handleContainer}
          {...handlePanResponder.panHandlers}
        >
          <View style={styles.handle} />
        </View>

        <View style={styles.content}>
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(31,27,23,0.2)',
  },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: 480,
    marginHorizontal: 'auto' as any,
    height: '75%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  fullScreen: {
    height: '92%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E4DFD6',
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
});
