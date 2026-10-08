# CSV Data Mapping

Reference CSV: 112 columns. Match headers explicitly; do not rely only on column position.

## Keys
- `RekeningBaru`: required, unique within one import, credit business identifier.
- `RekeningEfektif`: retain; unique in the reference file.
- `CIFBaru`: customer identifier but NOT unique; Customer 1:N CreditAccount.

## Mapping
|#|CSV|Domain|Recommended field|Type|UI|
|---:|---|---|---|---|---|
|1|RekeningLama|Identity|rekening_lama|text|detail|
|2|RekeningBaru|Credit|rekening|text|required/list/detail|
|3|RekeningEfektif|Credit|rekening_efektif|text|detail|
|4|NoSPk|Credit|no_spk|text|list/detail|
|5|CIFBaru|Customer|cif|text|required/list/detail|
|6|CIFLama|Customer|cif_lama|text|detail|
|7|CIFEfektif|Customer|cif_efektif|text|detail|
|8|NoIdentitas|Customer|nik|text|restricted|
|9|Nama|Customer|nama|text|list/detail|
|10|TglLahir|Customer|tanggal_lahir|date|detail|
|11|Alamat|Customer|alamat|text|detail|
|12|KodePos|Customer|kode_pos|text|detail|
|13|Desa|Customer|desa|text|detail|
|14|Kecamatan|Customer|kecamatan|text|detail|
|15|Kota|Customer|kota|text|detail|
|16|AlamatTinggal|Customer|alamat_tinggal|text|detail|
|17|Telepon|Customer|telepon|text|restricted|
|18|NamaPasangan|Customer|nama_pasangan|text|restricted|
|19|NoIdentitasPasangan|Customer|nik_pasangan|text|restricted|
|20|AlamatPasangan|Customer|alamat_pasangan|text|restricted|
|21|HPPasangan|Customer|hp_pasangan|text|restricted|
|22|PisahHarta|Customer|pisah_harta|text/boolean|detail|
|23|Pekerjaan|Customer|pekerjaan|text|detail|
|24|AlamatPekerjaan|Customer|alamat_pekerjaan|text|detail|
|25|TeleponKantor|Customer|telepon_kantor|text|restricted|
|26|Agama|Customer|agama|text|restricted|
|27|Umur|Customer|umur|integer|detail|
|28|Kelamin|Customer|jenis_kelamin|text|detail|
|29|Resiko|Classification|resiko|text|detail/report|
|30|Sifat Kredit|Classification|sifat_kredit|text|detail|
|31|JenisPenggunaan|Classification|jenis_penggunaan|text|detail|
|32|SumberDana|Classification|sumber_dana|text|detail|
|33|PeriodePembayaran|Classification|periode_pembayaran|text|detail|
|34|GolonganDebitur|Classification|golongan_debitur|text|detail|
|35|KategoriDebiturSlik|Classification|kategori_debitur_slik|text|detail/report|
|36|SektorEkonomiOJK|Classification|sektor_ekonomi_ojk|text|detail/report|
|37|Ket SektorEkonomiOJK|Classification|sektor_ekonomi_ojk_keterangan|text|detail/report|
|38|JenisUsaha|Classification|jenis_usaha|text|detail|
|39|GolonganPenjamin|Classification|golongan_penjamin|text|detail|
|40|BagianDijamin|Classification|bagian_dijamin|decimal|detail/report|
|41|Plafond|Financial|plafond|decimal|list/detail/report|
|42|SukuBunga|Financial|suku_bunga|decimal|list/detail|
|43|JW|Schedule|jangka_waktu|integer|detail|
|44|TglAwal|Schedule|tanggal_awal|date|detail|
|45|Tgl|Schedule|tanggal_data|date|detail|
|46|JTHTMP|Schedule|jatuh_tempo|date|list/detail|
|47|TglAkadAwal|Schedule|tanggal_akad_awal|date|detail|
|48|TglMulai|Schedule|tanggal_mulai|date|list/detail|
|49|TglAngsuranTerakhir|Schedule|tanggal_angsuran_terakhir|date|detail|
|50|TotalKewajibanPokok|Financial|total_kewajiban_pokok|decimal|detail/report|
|51|TotalKewajibanBunga|Financial|total_kewajiban_bunga|decimal|detail/report|
|52|SaldoTerakhirPokok|Financial|saldo_terakhir_pokok|decimal|detail/report|
|53|SaldoTerakhirBunga|Financial|saldo_terakhir_bunga|decimal|detail/report|
|54|TotalAngsuran|Financial|total_angsuran|decimal|list/detail/report|
|55|JenisKredit|Classification|jenis_kredit|text|list/detail|
|56|Restrukturisasi|Classification|restrukturisasi|text|detail/report|
|57|Bakidebet|Financial|baki_debet|decimal|list/detail/report|
|58|Provisi|Financial|provisi|decimal|detail/report|
|59|BiayaTransaksi|Financial|biaya_transaksi|decimal|detail/report|
|60|BakiDebetNetto|Financial|baki_debet_netto|decimal|list/detail/report|
|61|AngsBunga|Arrears|angs_bunga|decimal|detail|
|62|AngsPokok|Arrears|angs_pokok|decimal|detail|
|63|T.Pokok|Arrears|tunggakan_pokok|decimal|detail/report|
|64|FRHPokok|Arrears|frh_pokok|decimal|detail/report|
|65|FRPokok|Arrears|fr_pokok|decimal|detail/report|
|66|T.Bunga|Arrears|tunggakan_bunga|decimal|detail/report|
|67|T.Bunga Reschedule|Arrears|tunggakan_bunga_reschedule|decimal|detail/report|
|68|FRHBunga|Arrears|frh_bunga|decimal|detail/report|
|69|FRBunga|Arrears|fr_bunga|decimal|detail/report|
|70|TotalTunggakan|Arrears|total_tunggakan|decimal|list/detail/report|
|71|FR|Arrears|fr|decimal|detail/report|
|72|FR Hari|Arrears|fr_hari|integer|list/detail/report|
|73|Kol|Quality|kolektibilitas|text|list/detail/report|
|74|Kol Murni|Quality|kolektibilitas_murni|text|detail/report|
|75|Kode Sebab Macet|Quality|kode_sebab_macet|text|detail|
|76|Ket Kode Sebab Macet|Quality|keterangan_kode_sebab_macet|text|detail|
|77|Keterangan Sebab Macet|Quality|keterangan_sebab_macet|text|detail|
|78|Cara Perhitungan|Quality|cara_perhitungan|text|detail|
|79|KodeKeterkaitan|Relationship|kode_keterkaitan|text|detail|
|80|Keterkaitan|Relationship|keterkaitan|text|detail|
|81|Kode AO|Operations|kode_ao|text|internal/detail|
|82|AO|Operations|ao|text|list/detail/report|
|83|Kode Instansi|Operations|kode_instansi|text|detail|
|84|Instansi|Operations|instansi|text|detail/report|
|85|Kode Kolektor|Operations|kode_kolektor|text|detail|
|86|Kolektor|Operations|kolektor|text|detail/report|
|87|Kode JenisPengikatan|Collateral|kode_jenis_pengikatan|text|detail|
|88|JenisPengikatan|Collateral|jenis_pengikatan|text|detail|
|89|TglMacet|Quality|tanggal_macet|date|detail|
|90|JenisAgunan|Collateral|jenis_agunan|text|detail|
|91|NilaiJaminan|Collateral|nilai_jaminan|decimal|detail/report|
|92|NilaiUtkPPAP|Collateral|nilai_untuk_ppap|decimal|detail/report|
|93|NilaiPengurangPPAP|Collateral|nilai_pengurang_ppap|decimal|detail/report|
|94|PPAP|Financial|ppap|decimal|detail/report|
|95|AngsuranBlnDepan|Accrual|angsuran_bulan_depan|decimal|detail/report|
|96|JmlHariPembagi|Accrual|jumlah_hari_pembagi|integer|internal/report|
|97|HariAccrual|Accrual|hari_accrual|integer|internal/report|
|98|Accrual+TBunga|Accrual|accrual_plus_t_bunga|decimal|internal/report|
|99|Denda|Accrual|denda|decimal|detail/report|
|100|RekTabungan|Savings|rekening_tabungan|text|detail|
|101|Saldo|Savings|saldo_tabungan|decimal|detail|
|102|Saldo Blokir|Savings|saldo_blokir|decimal|detail|
|103|Saldo Minimum|Savings|saldo_minimum|decimal|detail|
|104|Saldo Efektif|Savings|saldo_efektif|decimal|detail/report|
|105|Detail Agunan|Collateral|detail_agunan|text|detail/restricted|
|106|GracePeriodPokok|Schedule|grace_period_pokok|integer|detail|
|107|GracePeriodBunga|Schedule|grace_period_bunga|integer|detail|
|108|Cabang|Organization|cabang|text|list/detail/report|
|109|TanggalTunggakan|Arrears|tanggal_tunggakan|date|detail/report|
|110|StatusPerkawinan|Customer|status_perkawinan|text|detail|
|111|Koordinat Tinggal|Customer|koordinat_tinggal|text|restricted|
|112|Perpanjangan|Classification|perpanjangan|text|detail|

## Type rules
- Money: PostgreSQL `numeric(18,2)` (or existing project Decimal convention).
- Identifiers: `text`, never integer; preserve leading zeroes.
- Dates: PostgreSQL `date`.
- `31-12-9999` in `TglMacet` should normalize to NULL unless business rules explicitly say otherwise.
- `Detail Agunan` remains source text in v1; do not unreliable-parse its free-form contents.

## Validation
Required: headers, `RekeningBaru`, `CIFBaru`, `Nama`, and any fields declared mandatory by the final business rules. Reject duplicate `RekeningBaru` within one file, invalid dates, invalid numeric values, empty files and oversized files.
