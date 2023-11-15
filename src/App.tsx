
import './App.css';
import { bitable, ITableMeta, IFieldMeta, IGetRecordsResponse, IGetRecordsParams, IRecord, ICurrencyFieldMeta, IOpenTextSegment, IOpenSegmentType, IViewMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form, Typography, Space, Spin, Toast } from '@douyinfe/semi-ui';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { useState, useEffect, useRef, useCallback } from 'react';
import { IconLink, IconCoinMoneyStroked, IconEditStroked, IconLanguage, IconPlusStroked } from '@douyinfe/semi-icons';
import Nzh from 'nzh';
import { useTranslation } from 'react-i18next';


export default function App() {
  const [tableMeta, setTableMeta] = useState<ITableMeta>();
  const [viewMeta, setViewMeta] = useState<IViewMeta>();
  const [fieldMetaList, setFieldMetaList] = useState<Array<IFieldMeta>>([]);
  const [moneyMeta, setMoneyMeta] = useState<IFieldMeta>()
  const [resultFieldMeta, setResultFieldMeta] = useState<IFieldMeta | null>()
  const [tempResultId, setTempResultId] = useState<string | null>()
  const [checking, setChecking] = useState<boolean>(false);
  const [currency, setCurrency] = useState<string>('CNY');
  const [prefix, setPrefix] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true)
  const formApi = useRef<BaseFormApi>();
  const selectResultRef = useRef<any>();
  const { t } = useTranslation();


  const currencyMap: { [key: string]: string } = {
    'CNY': '人民币',
    'USD': '美元',
    'EUR': '欧元',
    'GBP': '英镑',
    'AED': '阿联酋迪拉姆',
    'AUD': '澳大利亚元',
    'BRL': '巴西雷亚尔',
    'CAD': '加拿大元',
    'CHF': '瑞士法郎',
    'HKD': '港元',
    'INR': '印度卢比',
    'IDR': '印尼盾',
    'JPY': '日元',
    'KRW': '韩元',
    'MOP': '澳门元',
    'MXN': '墨西哥比索',
    'MYR': '马来西亚林吉特',
    'PHP': '菲律宾比索',
    'PLN': '波兰兹罗提',
    'RUB': '俄罗斯卢布',
    'SGD': '新加坡元',
    'THB': '泰国铢',
    'TRY': '土耳其里拉',
    'TWD': '新台币',
  }

  // 更新当前表格元数据
  const updateTableData = async (id: string | null) => {
    if (!id || id == tableMeta?.id) return
    setLoading(true)
    const tables = await bitable.base.getTableMetaList()
    const tMeta = tables.find(x => x.id == id)
    setTableMeta(tMeta)
  }

  const updateFieldMetaList = async () => {
    if (!tableMeta?.id) return
    const table = await bitable.base.getTableById(tableMeta?.id);
    const tableMetaList = await table.getFieldMetaList();
    setFieldMetaList(tableMetaList)
  }

  // 获取当前打开的表格
  useEffect(() => {
    bitable.base.getActiveTable().then(data => {
      updateTableData(data.id)
    })
    const off = bitable.base.onSelectionChange(async (event) => {
      updateTableData(event.data.tableId)
    })
  }, []);

  // 有了当前表格，获取表格字段元数据
  useEffect(() => {
    (async () => {
      if (!tableMeta?.id) return
      formApi.current?.reset()
      const table = await bitable.base.getTableById(tableMeta!.id);
      table.onFieldAdd(updateFieldMetaList)
      table.onFieldDelete(updateFieldMetaList)
      table.onFieldModify(updateFieldMetaList)
      await updateFieldMetaList()
    })()
  }, [tableMeta]);

  // 更新金额字段的币种
  useEffect(() => {
    if (moneyMeta && fieldMetaList) {
      const mM = fieldMetaList.find(x => x.id == moneyMeta.id)
      setCurrency((mM as ICurrencyFieldMeta)?.property?.currencyCode ?? 'CNY')
    }
  }, [moneyMeta, fieldMetaList])

  // 更新预览的币种
  useEffect(() => {
    formApi.current?.setValue('demo', (prefix ? currencyMap[currency] : '') + '壹佰贰拾叁元肆角伍分')
  }, [prefix, currency])


  // 更新结果字段
  useEffect(() => {
    if (!moneyMeta?.id || !Array.isArray(fieldMetaList)) {
      return
    }
    if (tempResultId) {
      const resultField = fieldMetaList.find(x => x.id == tempResultId)
      if (resultField?.id) {
        setTempResultId(null)
        setResultFieldMeta(resultField)
      }
    }
    selectResultRef?.current?.close()
  }, [moneyMeta, fieldMetaList, tempResultId]);

  // 更新结果字段
  useEffect(() => {
    if (!moneyMeta?.id || !Array.isArray(fieldMetaList)) {
      setLoading(false)
      return
    }

    const resultField = fieldMetaList.find(x => x.type == FieldType.Text && JSON.stringify(x.description.content).includes(`$capital@${moneyMeta?.id}`))
    if (resultField) {
      setResultFieldMeta(resultField)
    } else {
      setResultFieldMeta(null)
    }
    selectResultRef?.current?.close()
  }, [moneyMeta, fieldMetaList]);

  useEffect(() => {
    (async () => {
      formApi?.current?.setValue("resultName", resultFieldMeta?.id)
      await updateResultTag(resultFieldMeta?.id ?? "")
      setLoading(false)
    })()
  }, [resultFieldMeta]);

  // 开始检查
  useEffect(() => {
    (async () => {
      if (checking && resultFieldMeta?.name) {
        setLoading(true)
        await runConvert()
        setChecking(false)
        setLoading(false)
      }
    })()
  }, [checking, resultFieldMeta]);

  const allPage = async (getRecords: { (x: IGetRecordsParams): Promise<IGetRecordsResponse>; (arg0: { pageSize: number; pageToken: string; }): any; }, callback: { (records: IRecord[]): Promise<void>; (arg0: any): void; (arg0: any): void; constructor?: any; }) => {
    const pageSize = 5000
    let pageToken = ''
    let hasMore = true

    while (hasMore) {
      const res = await getRecords({ pageSize, pageToken })
      if (['Promise', 'AsyncFunction'].includes(callback.constructor.name)) {
        await callback(res.records)
      } else {
        callback(res.records)
      }
      hasMore = res.hasMore
      pageToken = res.pageToken ?? ''
    }
  }

  // 获取文本类单元格字符串值
  const getCellTextValue = (valObj: any): string => {
    if (valObj == null || valObj == undefined) return ''

    if (Array.isArray(valObj)) {
      if (valObj.length == 1) {
        if (typeof (valObj[0]) == 'object') {
          const text = valObj[0]?.text
          if (typeof (text) == 'string') {
            return text.trim()
          }
        } else {
          return valObj[0].toString()
        }
      }
    }
    if (typeof (valObj) != 'object') {
      return valObj.toString()
    }
    return ''
  }

  const runConvert = useCallback(async () => {
    setLoading(true)
    const table = await bitable.base.getTableById(tableMeta!.id);
    var nzh = new Nzh({
      ch: "零壹贰叁肆伍陆柒捌玖",      // 数字字符
      ch_u: "个拾佰仟万亿兆京",       // 数位单位字符，万以下十进制，万以上万进制，个位不能省略
      ch_f: "负",                   // 负字符
      ch_d: "点",                   // 小数点字符
      m_u: "元角分厘毫",              // 金额单位
      m_t: currencyMap[currency],  // 金额前缀
      m_z: "整"                    // 金额无小数后缀
    });

    await allPage((x: IGetRecordsParams) => table.getRecords(x), async (records: any[]) => {
      const writeBack = records.map((x: { fields: { [x: string]: any; }; recordId: any; }) => {
        const valObj = x.fields[moneyMeta!.id]
        let text = getCellTextValue(valObj)
        if (text) {
          const result = nzh.toMoney(text, { outSymbol: prefix })
          return {
            'recordId': x.recordId,
            'fields': {
              [resultFieldMeta!.id]: result,
            }
          } as IRecord
        }
        return {} as IRecord;
      })
      await table.setRecords(writeBack)
    })
  }, [tableMeta, currency, moneyMeta, resultFieldMeta, prefix])

  const onMoneyIDChange = (moneyID: any) => {
    const moneyMeta = fieldMetaList.find(x => x.id == moneyID)
    setMoneyMeta(moneyMeta)
  }

  const onResultIdChange = (id: any) => {
    setLoading(true)
    setTempResultId(id)
  }

  const fieldDescHas = (fieldMeta: IFieldMeta, tag: string): boolean => {
    return JSON.stringify(fieldMeta?.description).includes(tag)
  }

  // 只保留最后一个结果字段的标记
  const updateResultTag = useCallback(async (id_or_name: string) => {
    if (!tableMeta?.id || !moneyMeta?.id) return
    const table = await bitable.base.getTableById(tableMeta!.id)
    const tag = `$capital@${moneyMeta!.id}`

    for (const fieldMeta of fieldMetaList) {

      if (fieldMeta.id != id_or_name && fieldMeta.name != id_or_name) {
        // 非结果字段删除标记
        if (fieldDescHas(fieldMeta, tag)) {
          const newContent = fieldMeta?.description?.content?.slice().filter(x => !x.text.includes(tag))
          if (newContent) {
            await table.setField(fieldMeta.id, { description: { content: newContent } })
          }
        }
      } else {
        // 结果字段增加标记
        if (!fieldDescHas(fieldMeta, tag)) {
          const newContent = fieldMeta?.description?.content?.slice() ?? []
          const text = `[“${moneyMeta!.name}”${t('field_description')}]  ${tag}`
            ; (newContent as IOpenTextSegment[])?.push({ type: IOpenSegmentType.Text, text: text })
          await table.setField(fieldMeta.id, { description: { content: newContent } })
        }
      }
    }
  }, [tableMeta, moneyMeta, fieldMetaList])

  // 下拉框中创建结果字段
  const addNewField = useCallback(async () => {
    const resultName = formApi.current?.getValue('newFieldName')
    if (!resultName) {
      Toast.warning({
        content: t('new_field_placeholder'),
        duration: 2,
        stack: true,
      })
      return
    }
    setLoading(true)
    const table = await bitable.base.getTableById(tableMeta!.id);
    const tag = `$capital@${moneyMeta!.id}`
    const resultFieldID = await table.addField({
      name: resultName,
      type: FieldType.Text,
      description: {
        content: `[“${moneyMeta!.name}”${t('field_description')}]  ${tag}`,
        disableSyncToFormDesc: true
      },
    })
    // await updateResultTag(resultFieldID)
    setTempResultId(resultFieldID)
    selectResultRef?.current?.close()
  }, [tableMeta, moneyMeta])


  // 下拉框增加输入字段功能
  const outerBottomSlot =
    (
      <Space align='end' style={{ 'width': '100%', 'padding': '8px 32px' }}>
        <Form.Input prefix={<IconEditStroked />} noLabel field="newFieldName" placeholder={t('new_field_placeholder')} />
        <Button type="primary" icon={<IconPlusStroked />} onClick={addNewField}>{t('new_field')}</Button>
      </Space>
    )

  const formSubmit = useCallback(() => {
    if (moneyMeta?.id || resultFieldMeta?.id) {
      setChecking(true)
    }
  }, [moneyMeta, resultFieldMeta])

  const showFields = (fieldMetaList: IFieldMeta[]): JSX.Element[] => {
    return fieldMetaList.filter(x => !fieldDescHas(x, '$capital@fl') && [FieldType.Number, FieldType.Currency, FieldType.Formula, FieldType.Text, FieldType.Lookup].includes(x.type)).map((x) => {
      return (
        <Form.Select.Option key={x.id} value={x.id}>
          {x.name}
        </Form.Select.Option>
      )
    })
  }

  return (
    <main className="main">
      <Space spacing='loose'>
        <Typography.Title heading={3}>{t('current_table')}{tableMeta?.name ?? ''}</Typography.Title>{(!tableMeta?.name || loading) && <Spin />}
      </Space>
      <Form name="ConvertMoneyCapital" labelPosition='top' onSubmit={formSubmit} getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi} disabled={loading}>
        <Form.Select field='moneyID' label={t('amount_label')} placeholder={t('amount_label')} style={{ width: '100%' }} onChange={onMoneyIDChange} prefix={<IconCoinMoneyStroked />} filter>
          {
            Array.isArray(fieldMetaList) && showFields(fieldMetaList)
          }
        </Form.Select>

        <Form.Select field='resultName' label={t('target_label')} placeholder={t('target_placeholder')} style={{ width: '100%' }} onChange={onResultIdChange} prefix={<IconLanguage />} filter outerBottomSlot={outerBottomSlot} ref={selectResultRef} disabled={!moneyMeta?.id || loading}>
          {
            Array.isArray(fieldMetaList) && fieldMetaList.filter(x => x.type == FieldType.Text && x.id != moneyMeta?.id).map((x) => {
              return (
                <Form.Select.Option key={x.id} value={x.id}>
                  {x.name}
                </Form.Select.Option>
              );
            })
          }
        </Form.Select>

        <Space spacing={0} align='end' style={{ 'width': '100%' }}>
          <Form.Switch field='switch' label={t('prefix_label')} onChange={setPrefix} initValue={true} ></Form.Switch>
          <div style={{ 'flex': 1 }}><Form.Input field="demo" prefix={currency + '123.45' + ' →'} readonly={true} disabled={true} initValue={'壹佰贰拾叁元肆角伍分'} noLabel={true} alt='demo'></Form.Input></div>
        </Space>

        <br />
        <br />

        <Space spacing='loose'>
          <Button size='large' theme='solid' htmlType='submit' disabled={!resultFieldMeta?.id || loading} loading={checking} >{t('run')}</Button>
          <Typography.Text icon={<IconLink />} link={{ href: 'https://play.feishu.cn/wiki/Xzw8wbnHyiR7TTkdG0AcaXiYnpA', target: '_blank' }} underline>{t('guide')}</Typography.Text>
        </Space>

      </Form>
    </main >
  )
}