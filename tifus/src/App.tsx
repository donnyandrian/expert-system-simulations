import { Activity, Download, Stethoscope, Trash2 } from "lucide-react";
import { useState } from "react";
import * as XLSX from "xlsx";

interface Symptoms {
    demam: number;
    perut: number;
    lemas: number;
    mual: number;
    nafsuMakan: number;
}

interface ResultData {
    minRule1: number;
    cfRule1: number;
    minRule2: number;
    cfRule2: number;
    cfCombine: number;
    percentage: number;
    combineType: string;
}

interface HistoryEntry extends Symptoms {
    id: string;
    timestamp: string;
    percentage: string;
}

const getHistory = () => {
    const historyJson = localStorage.getItem("tifus_history");
    const history: HistoryEntry[] = historyJson ? JSON.parse(historyJson) : [];
    return history;
};

const getSymptomLabel = (val: number) => {
    if (val === -1) return "Pasti tidak (-1.0)";
    if (val <= -0.7) return "Sangat tidak yakin (-0.7 - -0.9)";
    if (val <= -0.4) return "Cukup tidak yakin (-0.4 - -0.6)";
    if (val < 0) return "Sedikit tidak yakin (-0.1 - -0.3)";
    if (val === 0) return "Netral / Tidak Tahu (0.0)";
    if (val <= 0.3) return "Sedikit yakin (0.1 - 0.3)";
    if (val <= 0.7) return "Cukup yakin (0.4 - 0.7)";
    if (val < 1) return "Sangat yakin (0.8 - 0.9)";
    return "Pasti ya (1.0)";
};

const getConclusionLabel = (val: number) => {
    if (val === -1) return "dipastikan tidak";
    if (val <= -0.7) return "kemungkinan besar tidak";
    if (val <= -0.4) return "kemungkinan tidak";
    if (val < 0) return "kemungkinan kecil tidak";
    if (val === 0) return "tidak dapat dipastikan";
    if (val <= 0.3) return "kemungkinan kecil";
    if (val <= 0.7) return "kemungkinan";
    if (val < 1) return "kemungkinan besar";
    return "dipastikan";
};

const fStr = (num: number, fracDigits = 4) => {
    return num.toLocaleString("en-US", {
        maximumFractionDigits: fracDigits,
        useGrouping: false,
    });
};

const fmt = (num: number, abs: boolean = false) => {
    const result = fStr(num, 4);

    if (num < 0 && !abs) return `(${result})`;
    else if (abs) return `|${result}|`;
    return result;
};
const addFmt = (a: number, b: number) => {
    if (b < 0) return `${fmt(a)} - ${fmt(Math.abs(b))}`;
    return `${fmt(a)} + ${fmt(b)}`;
};
const subFmt = (a: number, b: number) => {
    if (b < 0) return `${fmt(a)} + ${fmt(Math.abs(b))}`;
    return `${fmt(a)} - ${fmt(b)}`;
};

export default function App() {
    const [symptoms, setSymptoms] = useState<Symptoms>({
        demam: 0,
        perut: 0,
        lemas: 0,
        mual: 0,
        nafsuMakan: 0,
    });

    const [result, setResult] = useState<(ResultData & { combineCalc?: React.ReactNode }) | null>(
        null,
    );
    const [historyLength, setHistoryLength] = useState(getHistory().length);

    const handleInputChange = (key: keyof Symptoms, value: number) => {
        setSymptoms((prev) => ({ ...prev, [key]: value }));
    };

    // Fungsi simpan history ke localStorage
    const saveToHistory = (res: ResultData) => {
        const history = getHistory();

        const newEntry: HistoryEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toLocaleString("id-ID"),
            ...symptoms,
            percentage: res.percentage.toFixed(2) + "%",
        };

        const updatedHistory = [newEntry, ...history];
        localStorage.setItem("tifus_history", JSON.stringify(updatedHistory));

        setHistoryLength(updatedHistory.length);
    };

    const calculateCF = () => {
        // ATURAN 1: IF Demam Tinggi AND Sakit Perut THEN Tifus (CF Pakar = 0.8)
        const minRule1 = Math.min(symptoms.demam, symptoms.perut);
        const cfRule1 = minRule1 * 0.8;

        // ATURAN 2: IF Lemas AND Mual AND Tidak Nafsu Makan THEN Tifus (CF Pakar = 0.7)
        const minRule2 = Math.min(symptoms.lemas, symptoms.mual, symptoms.nafsuMakan);
        const cfRule2 = minRule2 * 0.7;

        // KOMBINASI CF dengan aturan nilai negatif
        let cfCombine: number;
        let combineCalc: React.ReactNode;
        let combineType: string;

        if (cfRule1 >= 0 && cfRule2 >= 0) {
            const calc1 = 1 - cfRule1;
            const calc2 = cfRule2 * calc1;
            cfCombine = cfRule1 + calc2;
            combineCalc = (
                <>
                    <li>
                        CF<sub>Gabung</sub> ={" "}
                        {`${addFmt(cfRule1, cfRule2)} \u00d7 (${subFmt(1, cfRule1)})`}
                    </li>
                    <li>
                        CF<sub>Gabung</sub> = {`${addFmt(cfRule1, cfRule2)} \u00d7 ${fmt(calc1)}`}
                    </li>
                    <li>
                        CF<sub>Gabung</sub> = {addFmt(cfRule1, calc2)}
                    </li>
                </>
            );
            combineType = "Keduanya Positif: CF1 + CF2 \u00d7 (1 - CF1)";
        } else if (cfRule1 < 0 && cfRule2 < 0) {
            const calc1 = 1 + cfRule1;
            const calc2 = cfRule2 * calc1;
            cfCombine = cfRule1 + calc2;
            combineCalc = (
                <>
                    <li>
                        CF<sub>Gabung</sub> ={" "}
                        {`${addFmt(cfRule1, cfRule2)} \u00d7 (${addFmt(1, cfRule1)})`}
                    </li>
                    <li>
                        CF<sub>Gabung</sub> = {`${addFmt(cfRule1, cfRule2)} \u00d7 ${fmt(calc1)}`}
                    </li>
                    <li>
                        CF<sub>Gabung</sub> = {addFmt(cfRule1, calc2)}
                    </li>
                </>
            );
            combineType = "Keduanya Negatif: CF1 + CF2 \u00d7 (1 + CF1)";
        } else {
            const calc1 = cfRule1 + cfRule2;
            const calc2 = Math.abs(cfRule1);
            const calc3 = Math.abs(cfRule2);
            const calc4 = Math.min(calc2, calc3);
            const calc5 = 1 - calc4;
            cfCombine = calc1 / calc5;
            combineCalc = (
                <>
                    <li>
                        CF<sub>Gabung</sub> ={" "}
                        {`(${addFmt(cfRule1, cfRule2)}) / (1 - min(${fmt(cfRule1, true)}, ${fmt(cfRule2, true)}))`}
                    </li>
                    <li>
                        CF<sub>Gabung</sub> ={" "}
                        {`${fmt(calc1)} / (1 - min(${fmt(calc2)}, ${fmt(calc3)}))`}
                    </li>
                    <li>
                        CF<sub>Gabung</sub> = {`${fmt(calc1)} / (${subFmt(1, calc4)})`}
                    </li>
                    <li>
                        CF<sub>Gabung</sub> = {`${fmt(calc1)} / ${fmt(calc5)}`}
                    </li>
                </>
            );
            combineType = "Berlawanan Tanda: (CF1 + CF2) / (1 - min(|CF1|, |CF2|))";
        }

        const percentage = cfCombine * 100;

        const finalResult = {
            minRule1,
            cfRule1,
            minRule2,
            cfRule2,
            cfCombine,
            percentage,
            combineType,
            combineCalc,
        };

        setResult(finalResult);
        saveToHistory(finalResult);
    };

    const exportToExcel = () => {
        const history = getHistory();

        if (history.length === 0) {
            alert("Tidak ada data history untuk diekspor.");
            return;
        }

        // Format data untuk Excel
        const dataForExcel = history.map((item) => ({
            "Waktu Diagnosis": item.timestamp,
            "Demam Tinggi (CF)": item.demam,
            "Sakit Perut (CF)": item.perut,
            "Badan Lemas (CF)": item.lemas,
            "Mual (CF)": item.mual,
            "Nafsu Makan (CF)": item.nafsuMakan,
            "Hasil Diagnosis (%)": item.percentage,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Diagnosis");

        // Download file
        XLSX.writeFile(workbook, `Laporan_Diagnosis_Tifus_${Date.now()}.xlsx`);
    };

    const clearHistory = () => {
        if (confirm("Apakah Anda yakin ingin menghapus semua riwayat diagnosis?")) {
            localStorage.removeItem("tifus_history");
            alert("History berhasil dihapus.");
            setHistoryLength(0);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex justify-center font-sans">
            <div className="max-w-3xl w-full space-y-6">
                {/* Header */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                        <Stethoscope size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Sistem Pakar Diagnosis Tifus
                        </h1>
                        <p className="text-slate-500">
                            Metode Certainty Factor (-1 s.d 1) — ATURAN HASIL REKAYASA
                        </p>
                    </div>
                </div>

                {/* Input Gejala */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2 flex items-center">
                        <Activity className="mr-2 h-5 w-5 text-slate-500" />
                        Intensitas Gejala Pasien
                    </h2>

                    <div className="space-y-6 mt-6">
                        {[
                            { id: "demam", label: "Demam Tinggi" },
                            { id: "perut", label: "Sakit Perut" },
                            { id: "lemas", label: "Badan Lemas" },
                            { id: "mual", label: "Merasa Mual" },
                            { id: "nafsuMakan", label: "Tidak Nafsu Makan" },
                        ].map((item) => (
                            <div key={item.id} className="space-y-2">
                                <label className="text-sm font-medium leading-none text-slate-700">
                                    {item.label}
                                </label>

                                {/* Gabungan Slider dan Text/Number Input */}
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="-1"
                                        max="1"
                                        step="0.1"
                                        value={symptoms[item.id as keyof Symptoms]}
                                        onChange={(e) =>
                                            handleInputChange(
                                                item.id as keyof Symptoms,
                                                parseFloat(e.target.value),
                                            )
                                        }
                                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <input
                                        type="number"
                                        min="-1"
                                        max="1"
                                        step="0.1"
                                        value={symptoms[item.id as keyof Symptoms].toString()}
                                        onChange={(e) => {
                                            let val = parseFloat(e.target.value);
                                            // Validasi: jika kosong/NaN set 0, cegah nilai di bawah -1 atau di atas 1
                                            if (isNaN(val)) val = 0;
                                            if (val > 1) val = 1;
                                            if (val < -1) val = -1;
                                            handleInputChange(item.id as keyof Symptoms, val);
                                        }}
                                        className="w-20 px-2 py-1.5 text-sm text-center border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-blue-600 transition-colors"
                                    />
                                </div>

                                <p className="text-xs text-slate-400 text-right">
                                    {getSymptomLabel(symptoms[item.id as keyof Symptoms])}
                                </p>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={calculateCF}
                        className="mt-8 w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 hover:bg-slate-900/90 h-10 px-4 py-2"
                    >
                        Mulai Diagnosis
                    </button>
                </div>

                {/* Hasil Analisis */}
                {result && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Hasil Diagnosis</h2>

                        <div className="space-y-4">
                            {/* Aturan 1 */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <h3 className="font-semibold text-slate-700 mb-2">
                                    Langkah Aturan 1
                                </h3>
                                <p className="text-sm text-slate-600 mb-1">
                                    <span className="font-mono">
                                        IF Demam ({fStr(symptoms.demam)}) AND Sakit Perut (
                                        {fStr(symptoms.perut)}) THEN Tifus (CF Pakar: 0.8)
                                    </span>
                                </p>
                                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1 ml-1">
                                    <li>
                                        Cari nilai minimum CF<sub>User</sub> = min(
                                        {fStr(symptoms.demam)}, {fStr(symptoms.perut)}) ={" "}
                                        <strong>{result.minRule1}</strong>
                                    </li>
                                    <li>
                                        CF<sub>1</sub> = {fmt(result.minRule1)} &times; 0.8 ={" "}
                                        <strong>{fStr(result.cfRule1)}</strong>
                                    </li>
                                </ul>
                            </div>

                            {/* Aturan 2 */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <h3 className="font-semibold text-slate-700 mb-2">
                                    Langkah Aturan 2
                                </h3>
                                <p className="text-sm text-slate-600 mb-1">
                                    <span className="font-mono">
                                        IF Lemas ({fStr(symptoms.lemas)}) AND Mual (
                                        {fStr(symptoms.mual)}) AND Tidak Nafsu Makan (
                                        {fStr(symptoms.nafsuMakan)}) THEN Tifus (CF Pakar: 0.7)
                                    </span>
                                </p>
                                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1 ml-1">
                                    <li>
                                        Cari nilai minimum CF<sub>User</sub> = min(
                                        {fStr(symptoms.lemas)}, {fStr(symptoms.mual)},{" "}
                                        {fStr(symptoms.nafsuMakan)}) ={" "}
                                        <strong>{fStr(result.minRule2)}</strong>
                                    </li>
                                    <li>
                                        CF<sub>2</sub> = {fmt(result.minRule2)} &times; 0.7 ={" "}
                                        <strong>{fStr(result.cfRule2)}</strong>
                                    </li>
                                </ul>
                            </div>

                            {/* Gabungan */}
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <h3 className="font-semibold text-blue-800 mb-2">
                                    Perhitungan CF Gabungan
                                </h3>
                                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1 ml-1">
                                    <li>
                                        Rumus Digunakan: <strong>{result.combineType}</strong>
                                    </li>
                                    {result.combineCalc}
                                    <li>
                                        CF<sub>Gabung</sub> ={" "}
                                        <strong>{fStr(result.cfCombine)}</strong>
                                    </li>
                                </ul>
                            </div>

                            {/* Kesimpulan */}
                            <div className="mt-6 p-6 border-2 border-slate-200 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">
                                        Kesimpulan Sistem
                                    </h3>
                                    <p className="text-slate-600 mt-1">
                                        Berdasarkan gejala yang diinputkan, sistem pakar
                                        menyimpulkan bahwa{" "}
                                        <strong>
                                            pasien {getConclusionLabel(result.cfCombine)} menderita
                                            Tifus
                                        </strong>{" "}
                                        dengan tingkat keyakinan sebesar:
                                    </p>
                                </div>
                                <div
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg text-white min-w-37.5 ${result.percentage >= 0 ? "bg-red-600" : "bg-slate-900"}`}
                                >
                                    <span className="text-3xl font-extrabold">
                                        {fStr(result.percentage, 2)}%
                                    </span>
                                    <span className="text-xs text-slate-200 mt-1 uppercase tracking-wider text-center">
                                        Tingkat Keyakinan
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">
                        History ({historyLength})
                    </h2>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={exportToExcel}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-100 transition"
                        >
                            <Download size={16} /> Laporan Excel
                        </button>
                        <button
                            onClick={clearHistory}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition"
                        >
                            <Trash2 size={16} /> Hapus History
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
