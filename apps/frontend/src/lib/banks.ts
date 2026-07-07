export interface Bank {
    id: string;
    bin: string;
    shortName: string;
    name: string;
    logo?: string;
}

// Danh sách một số ngân hàng phổ biến tại việt nam theo chuẩn VietQR
export const VIET_BANKS: Bank[] = [
    { id: "1", bin: "970436", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại thương Việt Nam" },
    { id: "2", bin: "970415", shortName: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam" },
    { id: "3", bin: "970418", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
    { id: "4", bin: "970405", shortName: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
    { id: "5", bin: "970422", shortName: "MBBank", name: "Ngân hàng TMCP Quân đội" },
    { id: "6", bin: "970407", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam" },
    { id: "7", bin: "970416", shortName: "ACB", name: "Ngân hàng TMCP Á Châu" },
    { id: "8", bin: "970432", shortName: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
    { id: "9", bin: "970423", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong" },
    { id: "10", bin: "970403", shortName: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín" },
    { id: "11", bin: "970431", shortName: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
    { id: "12", bin: "970428", shortName: "NamABank", name: "Ngân hàng TMCP Nam Á" },
    { id: "13", bin: "970443", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
    { id: "14", bin: "970409", shortName: "BacABank", name: "Ngân hàng TMCP Bắc Á" },
    { id: "15", bin: "970414", shortName: "Oceanbank", name: "Ngân hàng TNHH MTV Đại Dương" },
    { id: "16", bin: "970425", shortName: "ABBANK", name: "Ngân hàng TMCP An Bình" },
    { id: "17", bin: "970412", shortName: "PVcomBank", name: "Ngân hàng TMCP Đại Chúng Việt Nam" },
    { id: "18", bin: "970454", shortName: "VietCapitalBank", name: "Ngân hàng TMCP Bản Việt" },
    { id: "19", bin: "970427", shortName: "VietABank", name: "Ngân hàng TMCP Việt Á" },
    { id: "20", bin: "970424", shortName: "ShinhanBank", name: "Ngân hàng TNHH MTV Shinhan Việt Nam" },
    { id: "21", bin: "546034", shortName: "VIB", name: "Ngân hàng TMCP Quốc Tế Việt Nam" },
    { id: "22", bin: "970437", shortName: "HDBank", name: "Ngân hàng TMCP Phát triển TP.HCM" },
    { id: "23", bin: "970433", shortName: "Vietbank", name: "Ngân hàng TMCP Việt Nam Thương Tín" },
    { id: "24", bin: "970441", shortName: "Cake", name: "TMCP Việt Nam Thịnh Vượng - Ngân hàng số Cake by VPBank" },
    { id: "25", bin: "970429", shortName: "SCB", name: "Ngân hàng TMCP Sài Gòn" }
];
