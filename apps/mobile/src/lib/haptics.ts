import * as Haptics from "expo-haptics"

// The lesson's haptics, in one place: a light tap as the learner picks or moves something, and
// the system's success or error tap when an answer is checked, and a heavier one when the day's
// streak lantern lights. Each is fire-and-forget; a device without haptics ignores them.

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

/**
 * The streak's lantern lighting: a heavy tap as it catches, then the system's success, so a new
 * day in the streak lands harder than a right answer.
 */
export function milestone() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  setTimeout(
    () =>
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    120
  )
}
