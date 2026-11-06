/**
 * 도깨비의 세계 [외길] 문파 전용 스프레드시트 자동화 스크립트
 * 
 * [최신 버전 배포 방법 (필수!)]
 * 1. 이 코드를 전체 복사하여 구글 시트 [확장 프로그램] > [Apps Script]에 붙여넣고 저장(Ctrl+S)합니다.
 * 2. 상단 파란색 [배포] > [배포 관리] 클릭
 * 3. 오른쪽 위 연필 아이콘(수정) 클릭
 * 4. 버전 드롭다운에서 '신규(New version)' 선택 후 [배포] 클릭!
 *    (★신규 버전 배포를 해야 봇이 체크박스 체크 및 0 리셋을 정상 수행합니다!)
 */

// 34명 문파원 명단 기본 탑재
var DEFAULT_MEMBERS = [
  "뱀설", "상두불", "상겨미", "옥절이", "승기", "던롤", "꼬다야", "악군학", 
  "해암", "쬬아", "지골몬", "모던블루", "신지칸다", "끝장", "멍식2", "호랑이야", 
  "사찰", "채권", "불안이", "환이햄", "아아라", "행뚁", "우주여행", "딱딱똥", 
  "월계", "다하네", "승환킴", "탑몬스터", "강원도호랭이", "휴이랑", "영보천존", 
  "전등", "쪼로", "희옥이"
];

function getTargetSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * [마법의 원클릭 시트 생성/복구 함수]
 */
function setupDokkaebiSheet() {
  var ss = getTargetSpreadsheet();
  var sheet = ss.getSheets()[0];
  sheet.setName("주간 분배 정산");

  sheet.clear();
  sheet.clearFormats();
  sheet.setFrozenRows(7);

  // 1. 메인 타이틀
  var title = sheet.getRange("A1:J1");
  title.merge();
  title.setValue("⚔️ 도깨비의 세계 외길 문파 - 주간 컨텐츠 참여 & 용맹의 증표 분배 정산표");
  title.setBackground("#1a237e");
  title.setFontColor("#ffffff");
  title.setFontSize(14);
  title.setFontWeight("bold");
  title.setHorizontalAlignment("center");
  title.setVerticalAlignment("middle");
  sheet.setRowHeight(1, 46);

  // 2. 상단 요약 대시보드
  sheet.getRange("B3").setValue("💰 총 용맹의 증표").setFontWeight("bold").setBackground("#e8eaf6").setHorizontalAlignment("center");
  var c3 = sheet.getRange("C3");
  c3.setValue(2500).setFontWeight("bold").setFontSize(12).setBackground("#fff9c4").setHorizontalAlignment("right");
  c3.setNumberFormat("#,##0");

  sheet.getRange("B4").setValue("🎯 전체 총 참여수").setFontWeight("bold").setBackground("#e8eaf6").setHorizontalAlignment("center");
  sheet.getRange("C4").setFormula("=SUM(G8:G)").setFontWeight("bold").setBackground("#f5f5f5").setHorizontalAlignment("right").setNumberFormat("#,##0");

  sheet.getRange("B5").setValue("💎 1회당 증표 단가").setFontWeight("bold").setBackground("#e8eaf6").setHorizontalAlignment("center");
  sheet.getRange("C5").setFormula("=IF(C4>0, INT(C3/C4), 0)").setFontWeight("bold").setBackground("#f5f5f5").setHorizontalAlignment("right").setNumberFormat("#,##0");

  sheet.getRange("E3").setValue("✅ 지급 완료 총액").setFontWeight("bold").setBackground("#e8eaf6").setHorizontalAlignment("center");
  sheet.getRange("F3").setFormula("=SUM(H8:H)").setFontWeight("bold").setBackground("#f5f5f5").setHorizontalAlignment("right").setNumberFormat("#,##0");

  sheet.getRange("E4").setValue("🏦 잔여 증표 (문파금고)").setFontWeight("bold").setBackground("#e8eaf6").setHorizontalAlignment("center");
  sheet.getRange("F4").setFormula("=C3-F3").setFontWeight("bold").setBackground("#ffebee").setFontColor("#c62828").setHorizontalAlignment("right").setNumberFormat("#,##0");

  sheet.getRange("E5").setValue("👥 등록 문파원 수").setFontWeight("bold").setBackground("#e8eaf6").setHorizontalAlignment("center");
  sheet.getRange("F5").setFormula("=COUNTA(B8:B)").setFontWeight("bold").setBackground("#f5f5f5").setHorizontalAlignment("right");

  sheet.getRange("H3:J5").merge().setValue(
    "💡 [외길 문파 정산 안내]\n" +
    "• C3(노란색)에 정산할 '용맹의 증표' 총수량을 입력하세요.\n" +
    "• 4대 컨텐츠 참여 체크(☑) 시 개인 분배금이 실시간 자동 계산됩니다.\n" +
    "• 디스코드에 스크린샷을 올리면 봇이 닉네임을 감지해 자동 체크합니다!"
  ).setFontSize(9).setBackground("#f9fbe7").setVerticalAlignment("middle");

  sheet.getRange("B3:C5").setBorder(true, true, true, true, true, true, "#9fa8da", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("E3:F5").setBorder(true, true, true, true, true, true, "#9fa8da", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("H3:J5").setBorder(true, true, true, true, null, null, "#c0ca33", SpreadsheetApp.BorderStyle.SOLID);

  sheet.setRowHeight(3, 26);
  sheet.setRowHeight(4, 26);
  sheet.setRowHeight(5, 26);

  // 3. 테이블 헤더
  var headers = [
    "No", "문파원 닉네임", 
    "1. 요신 토벌령", "2. 결계지 방어", "3. 미혹의 정원", "4. 신기 쟁탈전", 
    "총 참여수", "분배 예정 증표", "지급 완료", "비고"
  ];
  var headerRange = sheet.getRange(7, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground("#283593");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  headerRange.setVerticalAlignment("middle");
  sheet.setRowHeight(7, 34);
  sheet.getRange("C7:F7").setBackground("#00695c");

  // 4. 문파원 데이터
  var checkboxValidation = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  var rowsData = [];

  for (var i = 0; i < DEFAULT_MEMBERS.length; i++) {
    rowsData.push([
      i + 1,
      DEFAULT_MEMBERS[i],
      false, false, false, false,
      "", "", false, ""
    ]);
  }

  var dataRange = sheet.getRange(8, 1, DEFAULT_MEMBERS.length, headers.length);
  dataRange.setValues(rowsData);

  sheet.getRange(8, 3, DEFAULT_MEMBERS.length, 4).setDataValidation(checkboxValidation);
  sheet.getRange(8, 9, DEFAULT_MEMBERS.length, 1).setDataValidation(checkboxValidation);

  for (var i = 0; i < DEFAULT_MEMBERS.length; i++) {
    var r = 8 + i;
    sheet.getRange("G" + r).setFormula("=COUNTIF(C" + r + ":F" + r + ", TRUE)");
    sheet.getRange("H" + r).setFormula("=IF($C$4>0, INT($C$3 * (G" + r + " / $C$4)), 0)");
    sheet.setRowHeight(r, 26);
  }

  var allDataRange = sheet.getRange(8, 1, DEFAULT_MEMBERS.length, headers.length);
  allDataRange.setFontSize(10);
  allDataRange.setVerticalAlignment("middle");
  allDataRange.setBorder(true, true, true, true, true, true, "#e0e0e0", SpreadsheetApp.BorderStyle.SOLID);

  sheet.getRange(8, 1, DEFAULT_MEMBERS.length, 1).setHorizontalAlignment("center");
  sheet.getRange(8, 2, DEFAULT_MEMBERS.length, 1).setHorizontalAlignment("center").setFontWeight("bold");
  sheet.getRange(8, 7, DEFAULT_MEMBERS.length, 1).setHorizontalAlignment("center").setFontWeight("bold").setBackground("#e8eaf6");
  sheet.getRange(8, 8, DEFAULT_MEMBERS.length, 1).setHorizontalAlignment("right").setFontWeight("bold").setFontColor("#1565c0").setBackground("#e8f5e9").setNumberFormat("#,##0");
  sheet.getRange(8, 10, DEFAULT_MEMBERS.length, 1).setHorizontalAlignment("left");

  // 열 너비
  sheet.setColumnWidth(1, 48);
  sheet.setColumnWidth(2, 145);
  sheet.setColumnWidth(3, 115);
  sheet.setColumnWidth(4, 115);
  sheet.setColumnWidth(5, 155);
  sheet.setColumnWidth(6, 115);
  sheet.setColumnWidth(7, 90);
  sheet.setColumnWidth(8, 135);
  sheet.setColumnWidth(9, 85);
  sheet.setColumnWidth(10, 140);

  return "✅ 외길 문파 정산표 세팅 완료!";
}

/**
 * [초기화 함수: 모든 체크박스를 false로 풀고 G열 수식을 0으로 확실하게 복구]
 */
function resetAllCheckboxes(sheet) {
  if (!sheet) {
    sheet = getTargetSpreadsheet().getSheets()[0];
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 8) return 0;
  var rowCount = lastRow - 7;

  // 1. C~F열 4대 컨텐츠 체크박스를 모두 false(해제)로 설정
  sheet.getRange(8, 3, rowCount, 4).setValue(false);

  // 2. I열 지급 완료 체크박스도 false로 해제
  sheet.getRange(8, 9, rowCount, 1).setValue(false);

  // 3. G열(총 참여수)에 COUNTIF 수식을 확실하게 재적용 (숫자 1로 박힌 것 제거)
  for (var i = 0; i < rowCount; i++) {
    var r = 8 + i;
    sheet.getRange("G" + r).setFormula("=COUNTIF(C" + r + ":F" + r + ", TRUE)");
    sheet.getRange("H" + r).setFormula("=IF($C$4>0, INT($C$3 * (G" + r + " / $C$4)), 0)");
  }

  SpreadsheetApp.flush();
  return rowCount;
}

/**
 * 웹 앱 요청 처리기 (디스코드 봇 통신)
 */
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = getTargetSpreadsheet().getSheets()[0];
    var params = {};

    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    var action = params.action || "get_members";

    if (action === "setup_sheet") {
      var msg = setupDokkaebiSheet();
      return makeJsonResponse({ success: true, message: msg });
    }

    if (action === "get_members") {
      var members = getMembersList(sheet);
      return makeJsonResponse({ success: true, members: members });
    }

    if (action === "add_participation") {
      var names = params.names || [];
      var contentName = params.content || "";
      if (typeof names === "string") {
        try { names = JSON.parse(names); } catch(e) { names = [names]; }
      }
      var res = checkParticipation(sheet, names, contentName);
      return makeJsonResponse({ success: true, updated: res.updated, unknown: res.unknown });
    }

    if (action === "add_member") {
      var added = addNewMember(sheet, params.name);
      return makeJsonResponse({ success: added });
    }

    if (action === "delete_member" || action === "remove_member") {
      var res = deleteMember(sheet, params.name);
      return makeJsonResponse(res);
    }

    if (action === "reset") {
      var resetCount = resetAllCheckboxes(sheet);
      return makeJsonResponse({ success: true, reset_count: resetCount });
    }

    return makeJsonResponse({ success: false, error: "알 수 없는 action: " + action });

  } catch (err) {
    return makeJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function makeJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getMembersList(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 8) return {};

  var range = sheet.getRange(8, 2, lastRow - 7, 6);
  var values = range.getValues();
  var members = {};

  for (var i = 0; i < values.length; i++) {
    var name = String(values[i][0]).trim();
    if (name) {
      var count = parseInt(values[i][5]) || 0;
      members[name] = {
        row: 8 + i,
        count: count
      };
    }
  }
  return members;
}

function checkParticipation(sheet, recognizedNames, contentName) {
  var members = getMembersList(sheet);
  var updated = [];
  var unknown = [];

  var targetCol = 0;
  if (contentName) {
    if (contentName.indexOf("요신") !== -1) targetCol = 3;
    else if (contentName.indexOf("결계") !== -1) targetCol = 4;
    else if (contentName.indexOf("미혹") !== -1) targetCol = 5;
    else if (contentName.indexOf("신기") !== -1) targetCol = 6;
  }

  for (var i = 0; i < recognizedNames.length; i++) {
    var name = recognizedNames[i];
    if (members[name]) {
      var row = members[name].row;
      var curCount = members[name].count || 0;

      if (targetCol > 0) {
        // 지정된 컨텐츠 체크박스를 true로 체크!
        sheet.getRange(row, targetCol).setValue(true);
      } else {
        var checked = false;
        for (var col = 3; col <= 6; col++) {
          var val = sheet.getRange(row, col).getValue();
          if (val === false || val === "") {
            sheet.getRange(row, col).setValue(true);
            checked = true;
            break;
          }
        }
        if (!checked) {
          sheet.getRange(row, 6).setValue(true);
        }
      }

      var newCount = curCount + 1;
      updated.push(name + " (" + newCount + "회 참여)");
    } else {
      unknown.push(name);
    }
  }

  // 모든 인원 체크 후 딱 1번만 구글 시트에 일괄 동기화 (초고속 처리)
  SpreadsheetApp.flush();
  return { updated: updated, unknown: unknown };
}

function addNewMember(sheet, name) {
  if (!name) return false;
  var members = getMembersList(sheet);
  if (members[name]) return false;

  var lastRow = Math.max(sheet.getLastRow() + 1, 8);
  var no = lastRow - 7;
  var checkboxValidation = SpreadsheetApp.newDataValidation().requireCheckbox().build();

  sheet.getRange(lastRow, 1).setValue(no).setHorizontalAlignment("center");
  sheet.getRange(lastRow, 2).setValue(name).setHorizontalAlignment("center").setFontWeight("bold");
  sheet.getRange(lastRow, 3, 1, 4).setDataValidation(checkboxValidation).setValue(false);
  sheet.getRange("G" + lastRow).setFormula("=COUNTIF(C" + lastRow + ":F" + lastRow + ", TRUE)").setHorizontalAlignment("center").setFontWeight("bold").setBackground("#e8eaf6");
  sheet.getRange("H" + lastRow).setFormula("=IF($C$4>0, INT($C$3 * (G" + lastRow + " / $C$4)), 0)").setHorizontalAlignment("right").setFontWeight("bold").setFontColor("#1565c0").setBackground("#e8f5e9").setNumberFormat("#,##0");
  sheet.getRange(lastRow, 9).setDataValidation(checkboxValidation).setValue(false);
  sheet.getRange(lastRow, 1, 1, 10).setBorder(true, true, true, true, true, true, "#e0e0e0", SpreadsheetApp.BorderStyle.SOLID);
  return true;
}

function deleteMember(sheet, name) {
  if (!name) return { success: false, message: "닉네임이 입력되지 않았습니다." };
  name = String(name).trim();

  var lastRow = sheet.getLastRow();
  if (lastRow < 8) return { success: false, message: "등록된 문파원이 없습니다." };

  // 8행부터 lastRow까지 B열(닉네임) 탐색
  var range = sheet.getRange(8, 2, lastRow - 7, 1);
  var values = range.getValues();
  var targetRow = -1;

  for (var i = 0; i < values.length; i++) {
    var rowName = String(values[i][0]).trim();
    if (rowName === name) {
      targetRow = 8 + i;
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, message: "'" + name + "' 문파원을 시트에서 찾을 수 없습니다." };
  }

  // 행 삭제
  sheet.deleteRow(targetRow);

  // 번호(No. - A열) 재정렬
  var newLastRow = sheet.getLastRow();
  if (newLastRow >= 8) {
    var count = newLastRow - 7;
    var numbers = [];
    for (var j = 1; j <= count; j++) {
      numbers.push([j]);
    }
    sheet.getRange(8, 1, count, 1).setValues(numbers);
  }

  SpreadsheetApp.flush();
  return { success: true, name: name, deleted_row: targetRow };
}
