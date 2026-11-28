import ExpoModulesCore
import UIKit

/// Plays a short motion on a native tab bar icon after it becomes selected.
///
/// UITabBar has no public API for animating item images, so this finds the
/// icon image views inside the tab bar and adds a Core Animation keyframe to
/// their layers. It only reads the view tree and never changes it: if a future
/// iOS lays the tab bar out differently and nothing matches, it does nothing.
public class TabMotionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TabMotion")

    Function("play") { (index: Int, kind: String) in
      // Let UIKit swap in the selected image first, then animate the new view.
      DispatchQueue.main.async {
        TabMotion.play(index: index, kind: kind)
      }
    }
  }
}

enum TabMotion {
  private static let animationKey = "folio.tabMotion"

  static func play(index: Int, kind: String) {
    guard !UIAccessibility.isReduceMotionEnabled else { return }
    guard let tabBar = visibleTabBar() else { return }
    let columns = iconColumns(in: tabBar)
    guard columns.indices.contains(index) else { return }
    let animation = makeAnimation(kind)
    for imageView in columns[index] {
      imageView.layer.add(animation, forKey: animationKey)
    }
  }

  // MARK: - Finding the icons

  private static func visibleTabBar() -> UITabBar? {
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .filter(\.isKeyWindow)
    for window in windows {
      if let bar = firstTabBar(in: window) { return bar }
    }
    return nil
  }

  private static func firstTabBar(in view: UIView) -> UITabBar? {
    if let bar = view as? UITabBar, !bar.isHidden, bar.window != nil {
      return bar
    }
    for subview in view.subviews {
      if let bar = firstTabBar(in: subview) { return bar }
    }
    return nil
  }

  /// Icon image views grouped by tab, left to right. One tab can own several
  /// image views (for example the glass selection lens draws a copy).
  private static func iconColumns(in tabBar: UITabBar) -> [[UIImageView]] {
    var all: [UIImageView] = []
    collectImageViews(in: tabBar, into: &all)
    // Prefer views inside a tab button so accessory content is ignored.
    let inButtons = all.filter(isInsideTabButton)
    let candidates = inButtons.isEmpty ? all : inButtons

    let placed = candidates
      .map { ($0, $0.convert($0.bounds, to: tabBar).midX) }
      .sorted { $0.1 < $1.1 }

    var columns: [[UIImageView]] = []
    var lastX: CGFloat = -.greatestFiniteMagnitude
    let sameColumn: CGFloat = 12
    for (view, x) in placed {
      if x - lastX > sameColumn || columns.isEmpty {
        columns.append([view])
      } else {
        columns[columns.count - 1].append(view)
      }
      lastX = x
    }
    return columns
  }

  private static func collectImageViews(in view: UIView, into result: inout [UIImageView]) {
    if let imageView = view as? UIImageView,
       imageView.image != nil,
       !imageView.isHidden,
       imageView.alpha > 0.01,
       (12...44).contains(imageView.bounds.width) {
      result.append(imageView)
    }
    for subview in view.subviews {
      collectImageViews(in: subview, into: &result)
    }
  }

  private static func isInsideTabButton(_ view: UIView) -> Bool {
    var current = view.superview
    while let ancestor = current {
      if String(describing: type(of: ancestor)).contains("TabBarButton")
        || String(describing: type(of: ancestor)).contains("TabButton") {
        return true
      }
      current = ancestor.superview
    }
    return false
  }

  // MARK: - Motions (mirrors the design canvas)

  private static func makeAnimation(_ kind: String) -> CAAnimation {
    switch kind {
    case "stamp":
      // Today: pressed down like a seal.
      let scale = keyframes("transform.scale", [1.35, 0.88, 1.04, 1], [0, 0.45, 0.7, 1])
      let fade = keyframes("opacity", [0.3, 1, 1, 1], [0, 0.45, 0.7, 1])
      return group([scale, fade], duration: 0.42)
    case "drop":
      // Inbox: settles into the tray.
      let move = keyframes("transform.translation.y", [-5, 1.5, -0.5, 0], [0, 0.5, 0.75, 1])
      return group([move], duration: 0.44)
    case "open":
      // Review: the book opens sideways.
      let open = keyframes("transform.scale.x", [0.35, 1.08, 1], [0, 0.6, 1])
      return group([open], duration: 0.42)
    default:
      // Bounce, matching the SF Symbols bounce feel.
      let bounce = keyframes("transform.scale", [1, 0.82, 1.14, 0.97, 1], [0, 0.22, 0.52, 0.76, 1])
      return group([bounce], duration: 0.46)
    }
  }

  private static func keyframes(_ keyPath: String, _ values: [CGFloat], _ times: [NSNumber]) -> CAKeyframeAnimation {
    let animation = CAKeyframeAnimation(keyPath: keyPath)
    animation.values = values
    animation.keyTimes = times
    animation.timingFunctions = Array(
      repeating: CAMediaTimingFunction(controlPoints: 0.16, 1, 0.3, 1),
      count: max(values.count - 1, 1)
    )
    return animation
  }

  private static func group(_ animations: [CAAnimation], duration: CFTimeInterval) -> CAAnimationGroup {
    let group = CAAnimationGroup()
    group.animations = animations
    group.duration = duration
    group.isRemovedOnCompletion = true
    return group
  }
}
