; NSIS 自定义脚本 — 由 electron-builder 的 nsis.include 引入（必须保留此文件并纳入 Git）
;
; 1) 卸载前若主程序仍存在，则执行 --clear-login-item
; 2) 在「安装目录」与「正在安装」之间增加一页：校验最终安装路径的最后一级文件夹名是否含空格。
;    与 assistedInstaller.nsh 中 instFilesPre 行为一致：若 INSTDIR 未含 APP_FILENAME 子目录则先拼接再校验。
;    这样可拦截 ...\OpenClaw Desktop，且不拒绝父级为 Program Files（空格在上一级）。
;
; electron-builder 在生成卸载程序时会单独跑一次 makensis 并定义 BUILD_UNINSTALLER；该 pass 不会插入
; Page custom，若仍定义 PathValidate* 会触发 warning 6010，且 -WX 下视为错误。故安装页与相关函数仅参与正式安装编译。

!macro customUnInit
  IfFileExists "$INSTDIR\OpenClaw Desktop.exe" 0 +2
  ExecWait '"$INSTDIR\OpenClaw Desktop.exe" --clear-login-item' $0
!macroend

!macro customPageAfterChangeDir
  !ifndef BUILD_UNINSTALLER
    Page custom PathValidateShow PathValidateLeave
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
!include "StrContains.nsh"
!include "nsDialogs.nsh"

Function PathValidateShow
  IfSilent path_validate_show_skip
  nsDialogs::Create 1018
  Pop $8
  ${NSD_CreateLabel} 0 12u 100% 24u "$(^Name)"
  Pop $7
  ${NSD_CreateLabel} 0 40u 100% 36u "Validating install folder name… / 正在校验安装文件夹名称…"
  Pop $7
  nsDialogs::Show
path_validate_show_skip:
FunctionEnd

Function PathValidateLeave
  StrCpy $R9 "$INSTDIR"
  ${StrContains} $0 "${APP_FILENAME}" $R9
  StrCmp $0 "" append_app_subdir
  Goto after_append_app_subdir
append_app_subdir:
  StrCpy $R9 "$R9\${APP_FILENAME}"
after_append_app_subdir:
  StrLen $0 $R9
  IntCmp $0 0 path_validate_ok
  IntOp $1 $0 - 1
  StrCpy $2 $R9 1 $1
  StrCmp $2 "\" 0 +3
  StrCpy $R9 $R9 $1
  Push $R9
  Call GetLeafSegment
  Pop $R0
  StrCmp $R0 "" path_validate_ok
  Push $R0
  Call StrHasSpace
  Pop $R1
  IntCmp $R1 0 path_validate_ok
  MessageBox MB_OK|MB_ICONEXCLAMATION "The install folder name cannot contain spaces.$\n$\nUse e.g. OpenClawDesktop instead of OpenClaw Desktop.$\n$\n安装文件夹名称不能包含空格，请使用例如 OpenClawDesktop。"
  Abort
path_validate_ok:
FunctionEnd

Function GetLeafSegment
  Pop $R9
  Push $R6
  Push $R7
  Push $R8
  StrCpy $R6 ""
  StrCpy $R7 0
leafloop:
  StrCpy $R8 $R9 1 $R7
  StrCmp $R8 "" leafdone
  StrCmp $R8 "\" leafreset
  StrCpy $R6 "$R6$R8"
  IntOp $R7 $R7 + 1
  Goto leafloop
leafreset:
  StrCpy $R6 ""
  IntOp $R7 $R7 + 1
  Goto leafloop
leafdone:
  StrCpy $R9 $R6
  Pop $R8
  Pop $R7
  Pop $R6
  Push $R9
FunctionEnd

Function StrHasSpace
  Pop $0
  Push $1
  Push $2
  StrCpy $1 0
spaceloop:
  StrCpy $2 $0 1 $1
  StrCmp $2 "" space_no
  StrCmp $2 " " space_yes
  StrCmp $2 "$\t" space_yes
  IntOp $1 $1 + 1
  Goto spaceloop
space_yes:
  StrCpy $0 1
  Goto space_out
space_no:
  StrCpy $0 0
space_out:
  Pop $2
  Pop $1
  Push $0
FunctionEnd

!endif
