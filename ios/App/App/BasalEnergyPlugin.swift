import Capacitor
import HealthKit

/**
 * 補 capacitor-health 缺的靜態能量（basalEnergyBurned）讀取。
 * 只做兩件事：請求讀取權限、查每日合計。由 AppViewController 註冊。
 */
@objc(BasalEnergyPlugin)
public class BasalEnergyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BasalEnergyPlugin"
    public let jsName = "BasalEnergy"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryDaily", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()

    @objc func requestPermission(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let type = HKObjectType.quantityType(forIdentifier: .basalEnergyBurned) else {
            call.resolve(["granted": false])
            return
        }
        store.requestAuthorization(toShare: [], read: [type]) { granted, _ in
            call.resolve(["granted": granted])
        }
    }

    @objc func queryDaily(_ call: CAPPluginCall) {
        guard let startText = call.getString("startDate"),
              let endText = call.getString("endDate"),
              let type = HKQuantityType.quantityType(forIdentifier: .basalEnergyBurned) else {
            call.reject("startDate 與 endDate 為必填")
            return
        }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        guard let start = withFraction.date(from: startText) ?? plain.date(from: startText),
              let end = withFraction.date(from: endText) ?? plain.date(from: endText) else {
            call.reject("日期格式需為 ISO8601")
            return
        }

        var day = DateComponents()
        day.day = 1
        let query = HKStatisticsCollectionQuery(
            quantityType: type,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate),
            options: .cumulativeSum,
            anchorDate: Calendar.current.startOfDay(for: start),
            intervalComponents: day
        )
        query.initialResultsHandler = { _, results, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.timeZone = TimeZone.current
            var days: [[String: Any]] = []
            results?.enumerateStatistics(from: start, to: end) { statistics, _ in
                let kcal = statistics.sumQuantity()?.doubleValue(for: .kilocalorie()) ?? 0
                if kcal > 0 {
                    days.append(["date": formatter.string(from: statistics.startDate), "kcal": kcal])
                }
            }
            call.resolve(["days": days])
        }
        store.execute(query)
    }
}
