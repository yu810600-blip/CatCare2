import Capacitor
import UIKit

/// 自訂的 bridge controller，用來註冊 App 內建的本地 plugin。
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BasalEnergyPlugin())
    }
}
