import * as Haptics from "expo-haptics"

// The lesson's haptics, in one place: a light tap as the learner picks or moves something, and
// the system's success or error tap when an answer is checked. Each is fire-and-forget; a device
// without haptics ignores them.

export function tap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

export function result(correct: boolean) {
  void Haptics.notificationAsync(
    correct
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Error
  )
}
